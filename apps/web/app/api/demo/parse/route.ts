import { NextResponse } from 'next/server'

import { sql } from '@/lib/db'
import type { SurveyInput } from '@/lib/survey'

const SYSTEM_PROMPT = `You convert a markdown description of a survey into a structured JSON schema.

Output ONLY valid JSON matching this TypeScript type (no explanation, no markdown fences):

type SurveyInput = {
  title: string
  description?: string
  sections: Array<{
    title?: string
    description?: string
    questions: Array<QuestionInput>
  }>
}

type QuestionInput =
  | { type: "single_choice"; label: string; description?: string; required?: boolean; options: Array<{ label: string }> }
  | { type: "multi_choice";  label: string; description?: string; required?: boolean; options: Array<{ label: string }> }
  | { type: "text";          label: string; description?: string; required?: boolean }
  | { type: "scale";         label: string; description?: string; required?: boolean; min: number; max: number; minLabel?: string; maxLabel?: string }
  | { type: "matrix";        label: string; description?: string; required?: boolean; rows: Array<{ label: string }>; columns: Array<{ label: string; options: Array<{ label: string }> }> }

Rules:
- Every question needs a type, label, and required (default false)
- scale range must be ≤ 11 points (e.g. 1-5, 0-10)
- single_choice and multi_choice must have at least one option
- matrix must have at least one row and one column (with options)
- Infer question types from context: checkboxes/lists → choice, open questions → text, rating/likelihood → scale
- Group related questions into sections; use a single section if structure is flat
- Preserve the original language of the markdown`

const LIMIT = 10
const WINDOW = '1 hour'

async function checkRateLimit(ip: string): Promise<boolean> {
  const rows = (await sql`
    INSERT INTO demo_rate_limits (ip, count, reset_at)
    VALUES (${ip}, 1, now() + ${WINDOW}::interval)
    ON CONFLICT (ip) DO UPDATE
    SET
      count = CASE
        WHEN demo_rate_limits.reset_at < now() THEN 1
        ELSE demo_rate_limits.count + 1
      END,
      reset_at = CASE
        WHEN demo_rate_limits.reset_at < now() THEN now() + ${WINDOW}::interval
        ELSE demo_rate_limits.reset_at
      END
    RETURNING count
  `) as Array<{ count: number }>

  return (rows[0]?.count ?? 1) <= LIMIT
}

export async function POST(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  let allowed: boolean

  try {
    allowed = await checkRateLimit(ip)
  } catch (err) {
    // If rate limit check fails, allow the request rather than blocking
    console.error('Rate limit check failed', err)
    allowed = true
  }

  if (!allowed) {
    return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 })
  }

  const body = (await request.json().catch(() => null)) as { markdown?: string } | null
  const markdown = body?.markdown?.trim()

  if (!markdown) {
    return NextResponse.json({ error: 'markdown is required' }, { status: 400 })
  }

  if (markdown.length > 10_000) {
    return NextResponse.json({ error: 'markdown too long (max 10000 chars)' }, { status: 400 })
  }

  const apiKey = process.env.LLM_API_KEY
  const baseUrl = process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1'
  const model = process.env.LLM_MODEL ?? 'gpt-4o-mini'

  if (!apiKey) {
    return NextResponse.json({ error: 'LLM not configured' }, { status: 503 })
  }

  let raw: string

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: markdown },
        ],
        temperature: 0,
        max_tokens: 4096,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('LLM error', response.status, text)
      return NextResponse.json({ error: 'LLM request failed' }, { status: 502 })
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>
    }
    raw = data.choices[0]?.message?.content ?? ''
  } catch (err) {
    console.error('LLM fetch error', err)
    return NextResponse.json({ error: 'LLM request failed' }, { status: 502 })
  }

  // Strip markdown fences if model ignores instructions
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  let schema: SurveyInput

  try {
    schema = JSON.parse(cleaned) as SurveyInput
  } catch {
    console.error('LLM returned invalid JSON', cleaned)
    return NextResponse.json({ error: 'LLM returned invalid JSON' }, { status: 502 })
  }

  return NextResponse.json({ schema })
}
