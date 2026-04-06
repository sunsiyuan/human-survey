'use client'

import { useState } from 'react'

import type { TextResultsQuestion } from '@/lib/results'

type TextResultProps = {
  question: TextResultsQuestion
}

export function TextResult({ question }: TextResultProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const textResponses = question.responses.map((response, index) => ({
    id: `${question.id}-${index}`,
    createdAt: response.created_at,
    value: response.value,
  }))

  if (textResponses.length === 0) {
    return <p className="text-sm text-slate-500">No text responses yet.</p>
  }

  return (
    <div className="space-y-3">
      {textResponses.map((response) => {
        const isExpanded = expanded[response.id]
        const shouldTruncate = response.value.length > 160
        const content =
          shouldTruncate && !isExpanded
            ? `${response.value.slice(0, 160).trimEnd()}...`
            : response.value

        return (
          <article key={response.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm leading-7 text-slate-700">{content}</p>
            <div className="mt-3 flex items-center justify-between gap-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                {new Date(response.createdAt).toLocaleString()}
              </p>
              {shouldTruncate ? (
                <button
                  type="button"
                  className="text-sm font-medium text-blue-600"
                  onClick={() =>
                    setExpanded((current) => ({
                      ...current,
                      [response.id]: !current[response.id],
                    }))
                  }
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                </button>
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}
