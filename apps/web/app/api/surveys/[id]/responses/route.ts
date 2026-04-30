import { nanoid } from 'nanoid'
import { NextResponse } from 'next/server'

import type { Survey } from '@/lib/survey'

import { requireAuth } from '@/lib/auth'
import { sql, parseJsonValue } from '@/lib/db'
import {
  ensureExpiredHandled,
  getSurveyClosureReason,
  mapClosureReasonForPayload,
} from '@/lib/lifecycle'
import {
  buildResultsPayload,
  computeNextCheckHintSeconds,
  type ResponseAnswerValue,
} from '@/lib/results'
import {
  tryCloseByMaxResponses,
  tryFireCompletionWebhook,
  tryFireThresholdWebhook,
} from '@/lib/webhook'

type RouteContext = {
  params: Promise<{ id: string }>
}

type ResponseAnswers = Record<string, string | string[] | number>

export async function POST(request: Request, context: RouteContext) {
  const { id: surveyId } = await context.params
  const body = (await request.json().catch(() => null)) as { answers?: ResponseAnswers } | null
  const answers = body?.answers

  if (!answers || typeof answers !== 'object') {
    return NextResponse.json({ error: 'Answers are required' }, { status: 400 })
  }

  try {
    const surveyRows = (await sql`
      SELECT id, status, response_count, max_responses, expires_at
      FROM surveys
      WHERE id = ${surveyId}
      LIMIT 1
    `) as Array<{
      id: string
      status: string
      response_count: number
      max_responses: number | null
      expires_at: string | null
    }>

    const survey = surveyRows[0]

    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
    }

    survey.status = await ensureExpiredHandled(survey)

    const closureReason = getSurveyClosureReason(survey)

    if (closureReason === 'closed') {
      return NextResponse.json({ error: 'This survey is closed' }, { status: 410 })
    }

    if (closureReason === 'expired') {
      return NextResponse.json({ error: 'This survey has expired' }, { status: 410 })
    }

    if (closureReason === 'full') {
      return NextResponse.json({ error: 'This survey is full' }, { status: 410 })
    }

    const responseId = nanoid(12)

    await sql`
      INSERT INTO responses (id, survey_id, answers)
      VALUES (${responseId}, ${surveyId}, ${JSON.stringify(answers)}::jsonb)
    `

    // Threshold first so the survey is still status='open' when the threshold webhook
    // fires. If notify_at_responses === max_responses, both fire on this response with
    // separate event_ids. Both helpers gate internally on the persisted response_count,
    // so they're race-safe against concurrent inserts that share a stale snapshot.
    await tryFireThresholdWebhook(surveyId)

    if (await tryCloseByMaxResponses(surveyId)) {
      await tryFireCompletionWebhook(surveyId, 'max_responses')
    }

    return NextResponse.json({ id: responseId }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAuth(request)
  if (auth instanceof Response) {
    return auth
  }

  const { id: surveyId } = await context.params
  const since = new URL(request.url).searchParams.get('since_response_id')

  try {
    const surveyRows = (await sql`
      SELECT api_key_id, schema, status, response_count, max_responses, expires_at
      FROM surveys
      WHERE id = ${surveyId}
      LIMIT 1
    `) as Array<{
      api_key_id: string | null
      schema: unknown
      status: string
      response_count: number
      max_responses: number | null
      expires_at: string | null
    }>

    const surveyRow = surveyRows[0]

    if (!surveyRow) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
    }

    if (surveyRow.api_key_id !== auth.keyId) {
      return NextResponse.json(
        { error: 'You do not have access to this survey' },
        { status: 403 },
      )
    }

    surveyRow.status = await ensureExpiredHandled({
      id: surveyId,
      status: surveyRow.status,
      expires_at: surveyRow.expires_at,
    })

    const responseRows = (await sql`
      SELECT id, answers, created_at, seq
      FROM responses
      WHERE survey_id = ${surveyId}
      ORDER BY seq DESC
    `) as Array<{ id: string; answers: unknown; created_at: string; seq: number }>

    // Keep seq internal: it's the cursor-ordering token, not part of the public payload.
    const seqById = new Map(responseRows.map((row) => [row.id, row.seq]))
    const allResponses = responseRows.map((row) => ({
      id: row.id,
      answers: parseJsonValue<Record<string, ResponseAnswerValue>>(row.answers),
      created_at: row.created_at,
    }))

    let filteredRaw = allResponses
    if (since) {
      const cursorSeq = seqById.get(since)
      if (cursorSeq !== undefined) {
        // seq is strictly monotonic AND its commit order matches its allocation order
        // *per survey*, because the AFTER INSERT trigger on responses takes a row lock
        // on surveys (via increment_response_count's UPDATE) that's held until commit.
        // Two concurrent inserts on the same survey thus serialize: tx N's seq is
        // allocated before tx N+1's, and tx N must commit before tx N+1's trigger can
        // proceed. So `seq > cursorSeq` cannot strand an in-flight earlier insert
        // behind a later visible one. (If the trigger ever changes to drop the
        // surveys-row lock, this filter would need a watermark/snapshot strategy.)
        filteredRaw = allResponses.filter((r) => (seqById.get(r.id) ?? 0) > cursorSeq)
      }
    }

    const closureReason = getSurveyClosureReason(surveyRow)
    const isFinal = closureReason !== null
    const completionReason = mapClosureReasonForPayload(closureReason)

    let nextCheckHintSeconds: number | null = null
    if (!isFinal) {
      const rateRows = (await sql`
        SELECT COUNT(*)::int AS count
        FROM responses
        WHERE survey_id = ${surveyId}
          AND created_at > now() - interval '1 hour'
      `) as Array<{ count: number }>
      const rate1h = rateRows[0]?.count ?? 0
      nextCheckHintSeconds = computeNextCheckHintSeconds({
        isFinal,
        expiresAt: surveyRow.expires_at,
        recentResponses1h: rate1h,
      })
    }

    return NextResponse.json(
      buildResultsPayload({
        survey: parseJsonValue<Survey>(surveyRow.schema),
        allResponses,
        filteredRaw,
        isFinal,
        completionReason,
        nextCheckHintSeconds,
      }),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
