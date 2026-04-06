import { nanoid } from 'nanoid'
import { NextResponse } from 'next/server'

import type { Survey } from '@mts/parser'

import { aggregateSurveyResults } from '@/lib/results'
import { supabase } from '@/lib/supabase'

type RouteContext = {
  params: Promise<{ id: string }>
}

type ResponseAnswers = Record<string, string | string[]>

export async function POST(request: Request, context: RouteContext) {
  const { id: surveyId } = await context.params
  const body = (await request.json().catch(() => null)) as { answers?: ResponseAnswers } | null
  const answers = body?.answers

  if (!answers || typeof answers !== 'object') {
    return NextResponse.json({ error: 'Answers are required' }, { status: 400 })
  }

  const responseId = nanoid(12)
  const { error } = await supabase.from('responses').insert({
    id: responseId,
    survey_id: surveyId,
    answers,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: responseId }, { status: 201 })
}

export async function GET(_request: Request, context: RouteContext) {
  const { id: surveyId } = await context.params
  const { data: surveyRow, error: surveyError } = await supabase
    .from('surveys')
    .select('schema')
    .eq('id', surveyId)
    .maybeSingle()

  if (surveyError) {
    return NextResponse.json({ error: surveyError.message }, { status: 500 })
  }

  if (!surveyRow) {
    return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('responses')
    .select('id, answers, created_at')
    .eq('survey_id', surveyId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    aggregateSurveyResults((surveyRow.schema ?? {}) as Survey, data ?? []),
  )
}
