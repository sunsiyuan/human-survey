'use client'

import { useEffect, useState } from 'react'

import type { SurveyInput } from '@/lib/survey'

const STORAGE_KEY = 'mts_demo_api_key'

const defaultMarkdown = `# User Interview Intake

Collect the missing details before the agent continues.

## Context

Which environment are you using? Choose one: Local, Staging, Production.

How urgent is this issue? Rate from 1 (Low) to 5 (Critical).

What have you tried already? Open text.`

type Step = 'idle' | 'parsing' | 'creating' | 'done' | 'rate_limited' | 'error'

type CreateKeyResponse = { id: string; key: string; name: string | null; created_at: string }
type CreateSurveyResponse = { survey_url: string; question_count: number }

export function TryItPanel() {
  const [apiKey, setApiKey] = useState('')
  const [markdown, setMarkdown] = useState(defaultMarkdown)
  const [schema, setSchema] = useState<SurveyInput | null>(null)
  const [surveyUrl, setSurveyUrl] = useState('')
  const [questionCount, setQuestionCount] = useState(0)
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [isGeneratingKey, setIsGeneratingKey] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) setApiKey(stored)
  }, [])

  function persistKey(key: string) {
    setApiKey(key)
    localStorage.setItem(STORAGE_KEY, key)
  }

  function handleCopy() {
    navigator.clipboard.writeText(apiKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  async function handleGenerateKey() {
    setIsGeneratingKey(true)
    setError('')

    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'browser-demo' }),
      })
      const payload = (await res.json()) as CreateKeyResponse & { error?: string }

      if (!res.ok) throw new Error(payload.error ?? 'Failed to create API key')

      persistKey(payload.key)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key')
    } finally {
      setIsGeneratingKey(false)
    }
  }

  async function handleCreate() {
    const trimmedKey = apiKey.trim()

    if (!trimmedKey) {
      setError('Create or paste an API key first.')
      return
    }

    setStep('parsing')
    setError('')
    setSchema(null)
    setSurveyUrl('')

    // Step 1: markdown → schema via LLM
    let parsedSchema: SurveyInput

    try {
      const res = await fetch('/api/demo/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown }),
      })

      if (res.status === 429) {
        setStep('rate_limited')
        return
      }

      const payload = (await res.json()) as { schema?: SurveyInput; error?: string }

      if (!res.ok || !payload.schema) {
        throw new Error(payload.error ?? 'Failed to parse markdown')
      }

      parsedSchema = payload.schema
      setSchema(parsedSchema)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse markdown')
      setStep('error')
      return
    }

    // Step 2: POST /api/surveys with key + schema
    setStep('creating')

    try {
      const res = await fetch('/api/surveys', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${trimmedKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ schema: parsedSchema }),
      })
      const payload = (await res.json()) as CreateSurveyResponse & { error?: string }

      if (!res.ok) throw new Error(payload.error ?? 'Failed to create survey')

      const fullUrl =
        typeof window !== 'undefined'
          ? new URL(payload.survey_url, window.location.origin).toString()
          : payload.survey_url

      setSurveyUrl(fullUrl)
      setQuestionCount(payload.question_count)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create survey')
      setStep('error')
    }
  }

  const isLoading = step === 'parsing' || step === 'creating'

  return (
    <section id="try-it" className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left: key + markdown */}
        <div className="space-y-3">
          {/* Key management */}
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-muted)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              API Key
            </p>
            {apiKey ? (
              <div className="mt-2 flex min-w-0 items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg border border-black/10 bg-white px-3 py-1.5 font-mono text-xs text-slate-700">
                  {apiKey}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 text-xs text-slate-400 hover:text-slate-700"
                >
                  {copied ? 'copied!' : 'copy'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    persistKey('')
                    setStep('idle')
                    setSchema(null)
                    setSurveyUrl('')
                  }}
                  className="shrink-0 text-xs text-slate-400 hover:text-slate-700"
                >
                  clear
                </button>
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  placeholder="mts_sk_... (paste existing)"
                  className="h-9 flex-1 rounded-lg border border-black/10 bg-white px-3 font-mono text-xs text-slate-900 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
                  onChange={(e) => {
                    if (e.target.value.startsWith('mts_sk_')) {
                      persistKey(e.target.value)
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleGenerateKey}
                  disabled={isGeneratingKey}
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-slate-900 px-4 text-xs font-semibold text-slate-950 transition hover:bg-slate-950 hover:text-white disabled:opacity-60"
                >
                  {isGeneratingKey ? 'Creating…' : 'Create key'}
                </button>
              </div>
            )}
          </div>

          {/* Markdown editor */}
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Input
          </p>
          <textarea
            className="min-h-40 w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--code-surface)] px-5 py-4 font-mono text-[13px] leading-6 text-[var(--accent-fg)] outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] sm:min-h-64 sm:text-sm sm:leading-7"
            value={markdown}
            onChange={(e) => {
              setMarkdown(e.target.value)
              if (error) setError('')
              if (step !== 'idle') {
                setStep('idle')
                setSchema(null)
                setSurveyUrl('')
              }
            }}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={isLoading || !markdown.trim()}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {step === 'parsing'
              ? 'Translating to schema…'
              : step === 'creating'
                ? 'Creating survey…'
                : 'Create survey'}
          </button>

          {error ? (
            <p className="text-sm text-rose-600">{error}</p>
          ) : null}
        </div>

        {/* Right: agent call display */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Agent call
          </p>

          {/* Rate limited nudge */}
          {step === 'rate_limited' ? (
            <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--code-surface)] px-5 py-6 text-center">
              <p className="text-sm font-semibold text-white">
                Demo limit reached.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Time to put your agent to work — connect it directly via API or
                MCP with the key you just created.
              </p>
              <a
                href="/docs"
                className="mt-4 inline-flex min-h-9 items-center justify-center rounded-full border border-white/20 px-4 text-xs font-semibold text-white transition hover:bg-white/10"
              >
                Read the docs
              </a>
            </div>
          ) : (
            <>
              {/* Schema panel */}
              <div
                className={`overflow-hidden rounded-2xl border bg-[var(--code-surface)] transition-opacity ${
                  schema
                    ? 'border-[var(--panel-border)] opacity-100'
                    : 'border-dashed border-white/10 opacity-40'
                }`}
              >
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                  <span className="font-mono text-[11px] text-slate-400">
                    POST /api/surveys
                  </span>
                  {schema ? (
                    <span className="rounded-full bg-emerald-900/50 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
                      schema ready
                    </span>
                  ) : (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10px] text-slate-500">
                      waiting
                    </span>
                  )}
                </div>
                <pre className="max-h-56 overflow-auto px-4 py-3 font-mono text-[12px] leading-5 text-[var(--accent-fg)]">
                  {schema
                    ? JSON.stringify({ schema }, null, 2)
                    : '{\n  "schema": { … }\n}'}
                </pre>
              </div>

              {/* Survey URL */}
              {step === 'done' && surveyUrl ? (
                <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--code-surface)] px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Respondent URL
                  </p>
                  <a
                    href={surveyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block break-all text-[var(--accent-fg)] underline underline-offset-2"
                  >
                    {surveyUrl}
                  </a>
                  <p className="mt-3 text-xs text-slate-400">
                    {questionCount} question{questionCount !== 1 ? 's' : ''} —
                    share this link, then fetch structured responses via{' '}
                    <code className="text-slate-300">
                      GET /api/surveys/:id/responses
                    </code>
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
