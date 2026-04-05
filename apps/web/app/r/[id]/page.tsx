import { notFound } from 'next/navigation'

import type { Survey } from '@mts/parser'

import { ResultsDashboard } from '@/components/results/ResultsDashboard'
import { supabase } from '@/lib/supabase'

type ResponseRecord = {
  id: string
  survey_id: string
  answers: Record<string, string | string[]>
  created_at: string
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ResultsPage({ params }: PageProps) {
  const { id } = await params
  const { data: surveyRow, error } = await supabase
    .from('surveys')
    .select('id, title, schema')
    .eq('result_id', id)
    .maybeSingle()

  if (error || !surveyRow) {
    notFound()
  }

  const { data: responses, error: responsesError } = await supabase
    .from('responses')
    .select('id, survey_id, answers, created_at')
    .eq('survey_id', surveyRow.id)
    .order('created_at', { ascending: false })

  if (responsesError) {
    notFound()
  }

  return (
    <ResultsDashboard
      surveyId={surveyRow.id}
      survey={surveyRow.schema as Survey}
      initialResponses={(responses ?? []) as ResponseRecord[]}
    />
  )
}
