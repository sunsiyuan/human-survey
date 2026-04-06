import { notFound } from 'next/navigation'

import type { Survey } from '@/lib/survey'

import { SurveyClosed } from '@/components/survey/SurveyClosed'
import { isSurveyClosed } from '@/lib/lifecycle'
import { SurveyForm } from '@/components/survey/SurveyForm'
import { sql, parseJsonValue } from '@/lib/db'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function SurveyPage({ params }: PageProps) {
  const { id } = await params
  const rows = (await sql`
    SELECT id, title, schema, status, response_count, max_responses, expires_at
    FROM surveys
    WHERE id = ${id}
    LIMIT 1
  `) as Array<{
    id: string
    title: string
    schema: unknown
    status: string
    response_count: number
    max_responses: number | null
    expires_at: string | null
  }>

  const data = rows[0]

  if (!data) {
    notFound()
  }

  if (isSurveyClosed(data)) {
    return <SurveyClosed title={data.title} />
  }

  return <SurveyForm surveyId={data.id} survey={parseJsonValue<Survey>(data.schema)} />
}
