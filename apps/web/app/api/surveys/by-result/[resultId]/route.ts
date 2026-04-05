import { NextResponse } from 'next/server'

import { supabase } from '@/lib/supabase'

type RouteContext = {
  params: Promise<{ resultId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { resultId } = await context.params
  const { data: survey, error } = await supabase
    .from('surveys')
    .select('id, result_id, title, description, schema')
    .eq('result_id', resultId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!survey) {
    return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
  }

  const { data: responses, error: responsesError } = await supabase
    .from('responses')
    .select('id, survey_id, answers, created_at')
    .eq('survey_id', survey.id)
    .order('created_at', { ascending: false })

  if (responsesError) {
    return NextResponse.json({ error: responsesError.message }, { status: 500 })
  }

  return NextResponse.json({
    survey_id: survey.id,
    result_id: survey.result_id,
    title: survey.title,
    description: survey.description,
    schema: survey.schema,
    responses: responses ?? [],
  })
}
