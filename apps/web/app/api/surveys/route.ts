import { nanoid } from 'nanoid'
import { NextResponse } from 'next/server'

import {
  buildSurveyFromInput,
  SurveyInputValidationError,
  type Survey,
  type SurveyInput,
} from '@/lib/survey'

import { requireAuth } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof Response) {
    return auth
  }

  const body = (await request.json().catch(() => null)) as
    | {
        schema?: SurveyInput
        max_responses?: number
        expires_at?: string | null
      }
    | null
  const schemaInput = body?.schema
  const maxResponses = body?.max_responses
  const expiresAt = body?.expires_at

  if (!schemaInput) {
    return NextResponse.json({ error: 'schema is required' }, { status: 400 })
  }

  if (
    maxResponses !== undefined &&
    (!Number.isInteger(maxResponses) || maxResponses <= 0)
  ) {
    return NextResponse.json(
      { error: 'max_responses must be a positive integer' },
      { status: 400 },
    )
  }

  if (
    expiresAt !== undefined &&
    expiresAt !== null &&
    Number.isNaN(Date.parse(expiresAt))
  ) {
    return NextResponse.json(
      { error: 'expires_at must be a valid ISO date' },
      { status: 400 },
    )
  }

  let survey: Survey

  try {
    survey = buildSurveyFromInput(schemaInput)
  } catch (error) {
    if (error instanceof SurveyInputValidationError) {
      return NextResponse.json(
        { error: 'Invalid schema', errors: error.errors },
        { status: 400 },
      )
    }

    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const id = nanoid(12)
  const questionCount = countQuestions(survey)

  try {
    await sql`
      INSERT INTO surveys (
        id,
        api_key_id,
        title,
        description,
        schema,
        markdown,
        status,
        max_responses,
        expires_at
      )
      VALUES (
        ${id},
        ${auth.keyId},
        ${survey.title},
        ${survey.description ?? null},
        ${JSON.stringify(survey)}::jsonb,
        ${JSON.stringify(schemaInput)},
        'open',
        ${maxResponses ?? null},
        ${expiresAt ?? null}::timestamptz
      )
    `
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json(
    {
      survey_url: `/s/${id}`,
      question_count: questionCount,
    },
    { status: 201 },
  )
}

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof Response) {
    return auth
  }

  try {
    const rows = (await sql`
      SELECT id, title, status, response_count, max_responses, expires_at, created_at
      FROM surveys
      WHERE api_key_id = ${auth.keyId}
      ORDER BY created_at DESC
    `) as Array<{
      id: string
      title: string
      status: string
      response_count: number
      max_responses: number | null
      expires_at: string | null
      created_at: string
    }>

    return NextResponse.json(rows)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function countQuestions(survey: Survey) {
  return survey.sections.reduce(
    (total, section) => total + section.questions.length,
    0,
  )
}
