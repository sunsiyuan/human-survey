'use client'

import { useMemo, useState } from 'react'

const defaultMarkdown = `# User Interview Intake

**Description:** Collect the missing details before the agent continues.

## Context

**Q1. Which environment are you using?**

- ☐ Local
- ☐ Staging
- ☐ Production

**Q2. How urgent is this issue?**

[scale 1-5 min-label="Low" max-label="Critical"]

**Q3. What have you tried already?**

> _______________________________________________`

type CreateKeyResponse = {
  id: string
  key: string
  name: string | null
  created_at: string
}

type CreateSurveyResponse = {
  survey_url: string
  question_count: number
}

export function TryItPanel() {
  const [agentName, setAgentName] = useState('browser demo')
  const [apiKey, setApiKey] = useState('')
  const [markdown, setMarkdown] = useState(defaultMarkdown)
  const [result, setResult] = useState<CreateSurveyResponse | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [isGeneratingKey, setIsGeneratingKey] = useState(false)
  const [isCreatingSurvey, setIsCreatingSurvey] = useState(false)

  const surveyUrl = useMemo(() => {
    if (!result) {
      return ''
    }

    if (typeof window === 'undefined') {
      return result.survey_url
    }

    return new URL(result.survey_url, window.location.origin).toString()
  }, [result])

  async function handleGenerateKey() {
    setIsGeneratingKey(true)
    setError('')
    setStatus('')

    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: agentName.trim() || 'browser demo' }),
      })
      const payload = (await response.json()) as CreateKeyResponse & { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to create API key')
      }

      setApiKey(payload.key)
      setStatus('API key created. You can use it to create surveys from this page or from MCP.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create API key')
    } finally {
      setIsGeneratingKey(false)
    }
  }

  async function handleCreateSurvey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsCreatingSurvey(true)
    setError('')
    setStatus('')
    setResult(null)

    try {
      const trimmedKey = apiKey.trim()

      if (!trimmedKey) {
        throw new Error('Create an API key first or paste an existing one.')
      }

      const response = await fetch('/api/surveys', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${trimmedKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ markdown }),
      })
      const payload = (await response.json()) as CreateSurveyResponse & { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to create survey')
      }

      setResult(payload)
      setStatus('Survey created. Share the respondent URL, then fetch structured results later.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create survey')
    } finally {
      setIsCreatingSurvey(false)
    }
  }

  return (
    <section
      id="try-it"
      className="rounded-[1.5rem] border border-black/10 bg-white/88 p-5 shadow-[0_24px_70px_-52px_rgba(14,23,38,0.32)] backdrop-blur sm:p-6"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Try It In Browser
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
            Generate a key, create a survey, and inspect the real API flow.
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-slate-600">
          This uses <code>POST /api/keys</code> and <code>POST /api/surveys</code>. No client-only
          shortcuts.
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.4fr_0.6fr]">
        <div className="space-y-4 rounded-[1.25rem] border border-[var(--panel-border)] bg-[var(--surface-muted)] p-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Agent Name
            </label>
            <input
              className="mt-2 h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              value={agentName}
              onChange={(event) => setAgentName(event.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              API Key
            </label>
            <textarea
              className="mt-2 min-h-28 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 font-mono text-xs leading-6 text-slate-900 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="mts_sk_..."
            />
          </div>

          <button
            type="button"
            onClick={handleGenerateKey}
            disabled={isGeneratingKey}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-900 px-5 text-sm font-semibold text-slate-950 transition hover:bg-slate-950 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGeneratingKey ? 'Creating key...' : 'Generate API key'}
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleCreateSurvey}>
          <textarea
            className="min-h-80 w-full rounded-[1.25rem] border border-[var(--panel-border)] bg-slate-950 px-4 py-4 font-mono text-[13px] leading-6 text-[var(--accent-fg)] outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] sm:px-5 sm:text-sm sm:leading-7"
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-slate-600">
              Use your own key or mint a demo key above. The survey response includes only a
              respondent URL and question count.
            </p>
            <button
              type="submit"
              disabled={isCreatingSurvey}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isCreatingSurvey ? 'Creating survey...' : 'Create survey'}
            </button>
          </div>
        </form>
      </div>

      {status ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {status}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 grid gap-3 rounded-[1.25rem] border border-black/10 bg-slate-950 p-4 text-sm text-slate-100 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Survey URL</p>
            <a className="mt-2 block break-all underline" href={surveyUrl}>
              {surveyUrl}
            </a>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Survey ID</p>
            <p className="mt-2 break-all text-xl font-semibold">{result.survey_url.split('/').at(-1)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Questions</p>
            <p className="mt-2 text-xl font-semibold">{result.question_count}</p>
          </div>
        </div>
      ) : null}
    </section>
  )
}
