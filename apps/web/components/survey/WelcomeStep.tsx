'use client'

import { useEffect } from 'react'

import type { Survey } from '@/lib/survey'

type WelcomeStepProps = {
  survey: Survey
  questionCount: number
  onStart: () => void
}

export function WelcomeStep({ survey, questionCount, onStart }: WelcomeStepProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'Enter') {
        e.preventDefault()
        onStart()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onStart])

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-12 sm:py-20">
      <div className="animate-[fadein_.3s_ease-out]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
          Survey
        </p>
        <h1 className="font-display mt-4 text-3xl leading-[1.08] tracking-[-0.02em] text-slate-950 sm:text-5xl">
          {survey.title}
        </h1>
        {survey.description ? (
          <p className="mt-5 max-w-xl text-base leading-[1.7] text-slate-700 sm:text-lg sm:leading-[1.7]">
            {survey.description}
          </p>
        ) : null}
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onStart}
            autoFocus
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--accent-strong)] px-6 text-sm font-semibold text-white shadow-[0_10px_30px_-15px_rgba(24,33,43,0.6)] transition hover:bg-slate-950 focus:outline-none focus:ring-4 focus:ring-[var(--accent-soft)]"
          >
            Start
            <span aria-hidden>→</span>
          </button>
          <span className="text-xs text-slate-600">
            {questionCount} question{questionCount === 1 ? '' : 's'} · press Enter ↵
          </span>
        </div>
      </div>
    </main>
  )
}
