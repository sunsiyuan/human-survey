import { nanoid } from 'nanoid'
import { NextResponse } from 'next/server'

import type { Survey } from '@mts/parser'

import { requireAuth } from '@/lib/auth'
import { sql, parseJsonValue } from '@/lib/db'
import { getSurveyClosureReason } from '@/lib/lifecycle'
import { aggregateSurveyResults } from '@/lib/results'

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

    return NextResponse.json({ id: responseId }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAuth(_request)
  if (auth instanceof Response) {
    return auth
  }

  const { id: surveyId } = await context.params

  try {
    const surveyRows = (await sql`
      SELECT api_key_id, schema
      FROM surveys
      WHERE id = ${surveyId}
      LIMIT 1
    `) as Array<{ api_key_id: string | null; schema: unknown }>

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

    const responseRows = (await sql`
      SELECT id, answers, created_at
      FROM responses
      WHERE survey_id = ${surveyId}
      ORDER BY created_at DESC
    `) as Array<{ id: string; answers: unknown; created_at: string }>

    return NextResponse.json(
      aggregateSurveyResults(
        parseJsonValue<Survey>(surveyRow.schema),
        responseRows.map((row) => ({
          ...row,
          answers: parseJsonValue<Record<string, string | string[] | number>>(row.answers),
        })),
      ),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
