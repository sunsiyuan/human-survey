import { notFound } from 'next/navigation'

import type { Survey } from '@mts/parser'

import { ResultsDashboard } from '@/components/results/ResultsDashboard'
import {
  aggregateSurveyResults,
  type ResponseRecord,
} from '@/lib/results'
import { supabase } from '@/lib/supabase'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ResultsPage({ params }: PageProps) {
  const { id } = await params
  const { data: legacySurveyRow, error } = await supabase
    .from('surveys')
    .select('id, title, schema, result_id')
    .eq('result_id', id)
    .maybeSingle()

  if (error) {
    notFound()
  }

  if (legacySurveyRow) {
    const { data: responses, error: responsesError } = await supabase
      .from('responses')
      .select('id, survey_id, answers, created_at')
      .eq('survey_id', legacySurveyRow.id)
      .order('created_at', { ascending: false })

    if (responsesError) {
      notFound()
    }

    return (
      <ResultsDashboard
        surveyId={legacySurveyRow.id}
        survey={legacySurveyRow.schema as Survey}
        initialResults={aggregateSurveyResults(
          legacySurveyRow.schema as Survey,
          (responses ?? []) as ResponseRecord[],
        )}
      />
    )
  }

  const { data: surveyRowById, error: surveyByIdError } = await supabase
    .from('surveys')
    .select('id, title, result_id')
    .eq('id', id)
    .maybeSingle()

  if (surveyByIdError || !surveyRowById || surveyRowById.result_id) {
    notFound()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.25)]">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
          Results access updated
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          {surveyRowById.title}
        </h1>
        <p className="mt-5 text-base leading-7 text-slate-600">
          Results are now accessed via the API. Use <code>get_results</code> in Claude Code
          or <code>GET /api/surveys/{'{id}'}/responses</code>.
        </p>
      </div>
    </main>
  )
}
