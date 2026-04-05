'use client'

import { useEffect, useState } from 'react'

import type { Survey } from '@mts/parser'

import { supabase } from '@/lib/supabase'

import { ChoiceResult } from './ChoiceResult'
import { MatrixResult } from './MatrixResult'
import { TextResult } from './TextResult'

type ResponseRecord = {
  id: string
  survey_id: string
  answers: Record<string, string | string[]>
  created_at: string
}

type ResultsDashboardProps = {
  surveyId: string
  survey: Survey
  initialResponses: ResponseRecord[]
}

export function ResultsDashboard({
  surveyId,
  survey,
  initialResponses,
}: ResultsDashboardProps) {
  const [responses, setResponses] = useState(initialResponses)

  useEffect(() => {
    const channel = supabase
      .channel('responses')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'responses',
          filter: `survey_id=eq.${surveyId}`,
        },
        (payload) => {
          const nextResponse = payload.new as ResponseRecord
          setResponses((current) => {
            if (current.some((entry) => entry.id === nextResponse.id)) {
              return current
            }

            return [nextResponse, ...current]
          })
        },
      )
      .subscribe()

    return () => {
      void channel.unsubscribe()
    }
  }, [surveyId])

  function exportCsv() {
    const headers = ['response_id', 'created_at', ...survey.sections.flatMap((section) =>
      section.questions.map((question) => question.label),
    )]

    const rows = responses.map((response) => {
      const questionValues = survey.sections.flatMap((section) =>
        section.questions.map((question) => {
          const value = response.answers[question.id]
          if (Array.isArray(value)) {
            return value.join('; ')
          }

          return value ?? ''
        }),
      )

      return [response.id, response.created_at, ...questionValues]
    })

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(','),
      )
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `${survey.title.toLowerCase().replace(/\s+/g, '-')}-results.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <header className="rounded-[2rem] bg-white px-6 py-8 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.3)] sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
            Live results
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {survey.title}
          </h1>
          <p className="mt-4 text-base text-slate-600">
            Total responses: <span className="font-semibold text-slate-900">{responses.length}</span>
          </p>
        </header>

        <div className="mt-8 space-y-6">
          {survey.sections.map((section) => (
            <section key={section.id} className="space-y-4">
              {section.title ? (
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>
                  {section.description ? (
                    <p className="mt-1 text-sm text-slate-500">{section.description}</p>
                  ) : null}
                </div>
              ) : null}
              {section.questions.map((question) => (
                <article
                  key={question.id}
                  className="rounded-[2rem] bg-white p-6 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.35)]"
                >
                  <h3 className="text-lg font-semibold text-slate-900">{question.label}</h3>
                  {question.description ? (
                    <p className="mt-2 text-sm text-slate-500">{question.description}</p>
                  ) : null}
                  <div className="mt-5">
                    {question.type === 'matrix' ? (
                      <MatrixResult question={question} responses={responses} />
                    ) : question.type === 'text' ? (
                      <TextResult question={question} responses={responses} />
                    ) : (
                      <ChoiceResult question={question} responses={responses} />
                    )}
                  </div>
                </article>
              ))}
            </section>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            className="min-h-11 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            onClick={exportCsv}
          >
            Export CSV
          </button>
        </div>
      </main>
    </div>
  )
}
