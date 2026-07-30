#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

import { CREDENTIALS_PATH, resolveApiKey, storeApiKey } from './credentials.js'
import {
  formatCatalog,
  formatRollup,
  formatUnresolved,
  type Rollup,
  type UnresolvedList,
} from './format.js'

/**
 * HumanSurvey MCP server — the agent interface to self-reported attribution.
 *
 * TWO THINGS HERE ARE THE PRODUCT, NOT DOCUMENTATION OF IT.
 *
 * The buyer does not read our docs and does not write JSON; they live in an agent. So a
 * model's entire understanding of this product comes from the tool descriptions below and
 * from the text in ./format.ts. Both are written to that standard:
 *
 *   - A description says what the tool does and what it returns. It does not say what the
 *     caller probably wants next, and it never names another tool. A description reading
 *     "the result can be passed to get_attribution" teaches a model that configuring a form
 *     is *for* reading a rollup — so it reads one, on a form with zero responses, and
 *     reports the empty result to a human as a finding.
 *
 *   - The formatted output makes the correct claim easy and the wrong one hard. A share is
 *     never printed on its own; see ./format.ts.
 *
 * DELIBERATELY ABSENT, so nobody later "completes the set":
 *
 *   - Raw cursor reads over responses, and the ?external_id= identity lookup. Those exist so
 *     a host can sync our answers into their own user table — their backend's job on a
 *     schedule, not a conversation's.
 *   - The conversion-events ingest. Events come from a payment webhook, not from an agent.
 *   - Anything that deletes a form or a response. An agent should not be able to destroy
 *     months of attribution history because one sentence was ambiguous.
 */

const API_BASE_URL = process.env.HUMANSURVEY_API_URL ?? 'https://www.humansurvey.co'

const server = new McpServer({
  name: 'humansurvey-mcp',
  version: '1.0.0',
})

function agentClient(): string {
  const info = server.server.getClientVersion()
  return info ? `${info.name}/${info.version}` : 'mcp'
}

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

function text(body: string, isError = false): ToolResult {
  return { content: [{ type: 'text', text: body }], isError }
}

const NO_KEY =
  'No API key. Two ways to get one:\n' +
  `  • sign in at ${API_BASE_URL} and put a key in your MCP config as HUMANSURVEY_API_KEY\n` +
  '  • or use the login tool, which mails a six-digit code and stores the key on this machine'

/**
 * Every authenticated call goes through here, so a missing key, a rejected key and an
 * unreachable host each produce one consistent sentence a model can act on rather than
 * three shapes it has to interpret.
 */
async function api(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  const key = resolveApiKey()

  if (!key) {
    return { ok: false, message: NO_KEY }
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${key}`,
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  } catch (error) {
    return {
      ok: false,
      message: `Could not reach ${API_BASE_URL}: ${error instanceof Error ? error.message : 'network error'}`,
    }
  }

  const data = (await response.json().catch(() => null)) as { error?: string; errors?: string[] } | null

  if (!response.ok) {
    if (response.status === 401) {
      return { ok: false, message: `The API key was rejected.\n\n${NO_KEY}` }
    }

    // The API reports every validation problem at once rather than one per round trip, so
    // pass the whole list through. A model that fixes one field per call burns a turn per
    // typo, and a candidate list can carry a dozen.
    const detail = data?.errors?.length ? `\n  - ${data.errors.join('\n  - ')}` : ''
    return { ok: false, message: `${data?.error ?? response.statusText}${detail}` }
  }

  return { ok: true, data }
}

// ---------------------------------------------------------------------------

server.registerTool(
  'login',
  {
    title: 'Sign in',
    description:
      'Sign in with an email address and store an API key on this machine. ' +
      'Called with only an email, it mails a six-digit code and returns nothing usable — the ' +
      'code has to come from the person, out of their inbox. Called with the email and that ' +
      'code, it stores a key at ~/.humansurvey/credentials and reports where it was written. ' +
      'The key itself is never printed. ' +
      'Signing in and signing up are the same act: an address that has never been used gets an ' +
      'account.',
    inputSchema: {
      email: z
        .string()
        .email()
        .describe('The person’s email address. They will read the code out of this inbox.'),
      code: z
        .string()
        .optional()
        .describe(
          'The six digits from the email. Omit on the first call — you cannot know this value; ' +
            'ask the person for it.',
        ),
      name: z.string().optional().describe('A label for the key, e.g. the project it is for.'),
    },
  },
  async ({ email, code, name }): Promise<ToolResult> => {
    if (!code) {
      const response = await fetch(`${API_BASE_URL}/api/auth/code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const payload = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        return text(`Could not send a code: ${payload?.error ?? response.statusText}`, true)
      }

      return text(
        `A six-digit code is on its way to ${email}. It expires in 10 minutes and works once.\n\n` +
          'Ask the person to read it out, then call login again with the same email and that code.',
      )
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        code,
        grant: 'api_key',
        name: name ?? 'mcp',
        agent_client: agentClient(),
      }),
    })

    const payload = (await response.json().catch(() => null)) as
      | { key?: string; id?: string; error?: string }
      | null

    if (!response.ok || !payload?.key) {
      return text(payload?.error ?? response.statusText, true)
    }

    // Written to disk, never returned. The version this replaces printed the key and asked
    // the human to save it, so the only copy lived in a transcript — and transcripts end.
    const path = storeApiKey(payload.key)

    return text(
      `Signed in as ${email}. The key is stored at ${path}, readable only by this user, and ` +
        'will be picked up automatically from now on.\n\n' +
        'It is not shown here on purpose — a key printed into a conversation is a key that ' +
        'ends with the conversation. It cannot be read back afterwards either, here or ' +
        'anywhere: only its hash is stored.',
    )
  },
)

server.registerTool(
  'get_catalog',
  {
    title: 'Platform catalog',
    description:
      'List the platforms HumanSurvey knows: the slug to use as catalog_slug, the display ' +
      'label, and which class of channel it is. These are the named channels a respondent can ' +
      'be shown — TikTok, ' +
      'ChatGPT, LinkedIn, Reddit and so on — plus the descriptive options that have no brand ' +
      'behind them, like "a friend or colleague told me". No API key needed.',
    inputSchema: {},
  },
  async (): Promise<ToolResult> => {
    const response = await fetch(`${API_BASE_URL}/api/attribution/catalog`)
    const payload = (await response.json().catch(() => null)) as
      | {
          platforms?: Parameters<typeof formatCatalog>[0]
          default_channel_slugs?: string[]
          error?: string
        }
      | null

    if (!response.ok || !payload?.platforms) {
      return text(`Could not read the catalog: ${payload?.error ?? response.statusText}`, true)
    }

    return text(formatCatalog(payload.platforms, payload.default_channel_slugs ?? []))
  },
)

server.registerTool(
  'list_forms',
  {
    title: 'List forms',
    description:
      'List the forms on this account: id, name, whether it is active or paused, whether it has ' +
      'been configured with questions yet, and how many responses it has collected.',
    inputSchema: {},
  },
  async (): Promise<ToolResult> => {
    const result = await api('/api/attribution/forms')

    if (!result.ok) {
      return text(result.message, true)
    }

    // A bare array, not { forms: [...] }. Reading a `.forms` property off it yielded
    // undefined on every call, so the tool cheerfully reported "no forms on this account"
    // to accounts that had forms — a wrong answer that looks exactly like a right one.
    const forms = Array.isArray(result.data) ? (result.data as Array<Record<string, unknown>>) : []

    if (forms.length === 0) {
      return text('No forms on this account yet.')
    }

    const lines = forms.map((form) => {
      const configured =
        form.current_version === null || form.current_version === undefined
          ? 'NOT CONFIGURED — shows nothing to respondents'
          : `config v${String(form.current_version)}`

      return `  ${String(form.id)}  ${String(form.name)}  [${String(form.status)} · ${configured} · ${String(form.response_count ?? 0)} responses]`
    })

    return text([`${forms.length} form(s):`, ...lines].join('\n'))
  },
)

server.registerTool(
  'get_form',
  {
    title: 'Read a form',
    description:
      'Read one form: its settings, and the question configuration currently shown to ' +
      'respondents — every question, every candidate, and the order mode. Returns the ' +
      'configuration as JSON, because that is the exact shape a configuration write takes.',
    inputSchema: {
      form_id: z.string().describe('The form id, as reported by the forms listing.'),
    },
  },
  async ({ form_id }): Promise<ToolResult> => {
    const result = await api(`/api/attribution/forms/${encodeURIComponent(form_id)}`)

    if (!result.ok) {
      return text(result.message, true)
    }

    return text(JSON.stringify(result.data, null, 2))
  },
)

server.registerTool(
  'create_form',
  {
    title: 'Create a form',
    description:
      'Create a form and return its id and its respondent URL. The form has no questions yet ' +
      'and shows nothing to respondents until it is configured. ' +
      'allowed_origins restricts which sites may embed it; leaving it empty allows any site, ' +
      'which means any site can spend this account’s response quota.',
    inputSchema: {
      name: z.string().describe('An internal label. Respondents never see it.'),
      allowed_origins: z
        .array(z.string())
        .optional()
        .describe(
          'Origins permitted to embed the form, e.g. ["https://app.example.com"]. Scheme and ' +
            'host only — a path is rejected rather than trimmed.',
        ),
      theme: z
        .object({
          accent: z.string().optional().describe('Hex color, e.g. "#4F46E5".'),
          radius: z.number().int().min(0).max(48).optional().describe('Corner radius in px.'),
          font: z.string().optional().describe('CSS font-family list.'),
          dark_mode: z.enum(['light', 'dark', 'auto']).optional(),
        })
        .optional()
        .describe('Exactly these four tokens. Any other key is rejected rather than ignored.'),
    },
  },
  async ({ name, allowed_origins, theme }): Promise<ToolResult> => {
    const result = await api('/api/attribution/forms', {
      method: 'POST',
      body: { name, allowed_origins, theme },
    })

    if (!result.ok) {
      return text(result.message, true)
    }

    const data = result.data as { id?: string; form_url?: string; warnings?: string[] }
    const warnings = data.warnings?.length
      ? `\n\n${data.warnings.map((warning) => `Note: ${warning}`).join('\n')}`
      : ''

    return text(`Form ${data.id} created.\nRespondent URL: ${data.form_url}${warnings}`)
  },
)

server.registerTool(
  'configure_form',
  {
    title: 'Configure the questions',
    description:
      'Set the questions and candidates a form shows. Replaces the whole configuration and ' +
      'stores it as a new immutable version, so responses already collected keep describing the ' +
      'list they were actually shown. Re-sending an identical configuration reuses the existing ' +
      'version rather than making another.\n\n' +
      'A form is one single-select question, optionally expanding into a second. Give a candidate ' +
      'an `expands` naming another question to reveal it when that candidate is picked — that is ' +
      'how "TikTok" becomes "which account".\n\n' +
      'Candidate ids must be stable keys that survive a rename. Using a handle as an id splits ' +
      'that creator’s history in two the day they change it.\n\n' +
      'Set catalog_slug to take a candidate’s label and logo from the platform catalog. Order ' +
      'defaults to "rotate", which randomizes per respondent and is what makes the reported ' +
      'shares unbiased; "fixed" keeps your order and accepts that earlier options get picked ' +
      'more often for being earlier.',
    inputSchema: {
      form_id: z.string().describe('The form to configure.'),
      nodes: z
        .array(
          z.object({
            id: z
              .string()
              .describe('Stable question id, e.g. "channel". Answers are recorded against it.'),
            prompt: z.string().describe('What the respondent reads.'),
            order: z
              .enum(['fixed', 'rotate'])
              .optional()
              .describe('Defaults to "rotate". Read the tool description before choosing "fixed".'),
            allow_free_text: z
              .boolean()
              .optional()
              .describe('Defaults to true: the respondent can type an answer that is not on the list.'),
            candidates: z
              .array(
                z.object({
                  id: z.string().describe('Caller-defined stable key. Not the handle.'),
                  label: z.string().optional().describe('Displayed. Optional when catalog_slug is set.'),
                  handle: z.string().optional().describe('Displayed beside the label, e.g. "@jade.work0".'),
                  icon_url: z.string().optional().describe('Avatar or logo. Falls back to a monogram tile.'),
                  aliases: z
                    .array(z.string())
                    .optional()
                    .describe(
                      'Matched by the respondent’s search and never displayed. Descriptions work ' +
                        'well here — people remember "the one who does office stuff", not a handle.',
                    ),
                  catalog_slug: z.string().optional().describe('A slug from the platform catalog.'),
                  expands: z
                    .string()
                    .optional()
                    .describe('Id of the question to reveal when this candidate is picked.'),
                  pinned: z
                    .literal('end')
                    .optional()
                    .describe('Renders last and is excluded from ordering. At most one per question.'),
                  dont_remember: z
                    .literal(true)
                    .optional()
                    .describe(
                      'Marks the "I don’t remember" escape hatch. Requires pinned:"end". Picking it ' +
                        'is recorded as no answer rather than as a channel, so do not set it on a real ' +
                        'option — that option would vanish from the numbers.',
                    ),
                }),
              )
              .describe('At least one.'),
          }),
        )
        .describe(
          'One to twelve questions. Exactly one must not be reachable by any `expands` — that one ' +
            'is asked first.',
        ),
    },
  },
  async ({ form_id, nodes }): Promise<ToolResult> => {
    const result = await api(`/api/attribution/forms/${encodeURIComponent(form_id)}`, {
      method: 'PUT',
      body: { nodes },
    })

    if (!result.ok) {
      return text(result.message, true)
    }

    const data = result.data as { version?: number; created?: boolean; warnings?: string[] }
    const warnings = data.warnings?.length
      ? `\n\n${data.warnings.map((warning) => `Note: ${warning}`).join('\n')}`
      : ''

    return text(
      data.created
        ? `Configuration v${data.version} is now live on form ${form_id}.${warnings}`
        : `Identical to the existing v${data.version}, which is live again on form ${form_id}. No new version was made.${warnings}`,
    )
  },
)

server.registerTool(
  'get_attribution',
  {
    title: 'Attribution rollup',
    description:
      'What respondents said, aggregated. Reports, per question, how many completed responses ' +
      'named each candidate out of how many answered that question, the unresolved answers in ' +
      'the same list, how often a follow-up question failed to find an answer, and revenue where ' +
      'conversion events have been recorded.\n\n' +
      'Computed fresh on every call, including any mappings made since — so a rollup of a past ' +
      'window can legitimately change between two reads.',
    inputSchema: {
      form_id: z
        .string()
        .describe(
          'The form to report on. Required: combining forms would mix two respondent ' +
            'populations into one denominator.',
        ),
      from: z
        .string()
        .optional()
        .describe('Start of the window, inclusive. ISO 8601; a value with no timezone is read as UTC.'),
      to: z.string().optional().describe('End of the window, exclusive.'),
      by: z
        .enum(['candidate', 'node'])
        .optional()
        .describe('"candidate" (default) is one row per option; "node" collapses to one row per question.'),
      metric: z
        .enum(['responses', 'revenue'])
        .optional()
        .describe('Sort order only. Counts and revenue are both always reported.'),
    },
  },
  async ({ form_id, from, to, by, metric }): Promise<ToolResult> => {
    const params = new URLSearchParams({ form_id })

    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (by) params.set('by', by)
    if (metric) params.set('metric', metric)

    const result = await api(`/api/attribution/rollup?${params.toString()}`)

    if (!result.ok) {
      return text(result.message, true)
    }

    return text(formatRollup(result.data as Rollup))
  },
)

server.registerTool(
  'list_unresolved',
  {
    title: 'Free-text answers',
    description:
      'The answers respondents typed instead of picking from the list, grouped by the exact text ' +
      'and ordered by how often it was typed. Reports the spelling variants seen, when each was ' +
      'first and last typed, and whether a mapping already covers it.\n\n' +
      'These are verbatim words. Two texts that read alike may be different people, and a text ' +
      'may name somebody who is not on the candidate list at all.',
    inputSchema: {
      form_id: z.string().describe('The form to read.'),
      from: z.string().optional().describe('Start of the window, inclusive.'),
      to: z.string().optional().describe('End of the window, exclusive.'),
      include_mapped: z
        .boolean()
        .optional()
        .describe('Include texts that a live mapping already resolves. Off by default.'),
      limit: z.number().int().min(1).max(500).optional(),
    },
  },
  async ({ form_id, from, to, include_mapped, limit }): Promise<ToolResult> => {
    const params = new URLSearchParams()

    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (include_mapped) params.set('include_mapped', '1')
    if (limit) params.set('limit', String(limit))

    const query = params.toString()
    const result = await api(
      `/api/attribution/forms/${encodeURIComponent(form_id)}/unresolved${query ? `?${query}` : ''}`,
    )

    if (!result.ok) {
      return text(result.message, true)
    }

    return text(formatUnresolved(result.data as UnresolvedList))
  },
)

server.registerTool(
  'remap',
  {
    title: 'Map a typed answer to a candidate',
    description:
      'Record that a specific typed answer means a specific candidate. It applies to every ' +
      'response already carrying that text as well as every future one, so numbers reported for ' +
      'past windows change.\n\n' +
      'The original text is never altered and a mapping can be revoked, but a report may already ' +
      'have been read. Only map a text whose meaning is established — a text that merely ' +
      'resembles a candidate’s name is not evidence that it is that candidate.\n\n' +
      'One live mapping per text per question.',
    inputSchema: {
      form_id: z.string(),
      node_id: z
        .string()
        .describe(
          'The question the text was typed into. The same words can mean different things in ' +
            'different questions.',
        ),
      raw: z
        .string()
        .describe('The typed text, exactly as reported. It is normalized the same way on both sides.'),
      candidate_id: z
        .string()
        .describe(
          'The candidate it means. Not validated against the current configuration, because a ' +
            'candidate may have been removed while its history still needs the mapping.',
        ),
      note: z.string().optional().describe('Why. Kept with the mapping.'),
    },
  },
  async ({ form_id, node_id, raw, candidate_id, note }): Promise<ToolResult> => {
    const result = await api(`/api/attribution/forms/${encodeURIComponent(form_id)}/remaps`, {
      method: 'POST',
      body: { node_id, raw, candidate_id, note },
    })

    if (!result.ok) {
      return text(result.message, true)
    }

    const data = result.data as {
      remap?: { id?: string; raw_normalized?: string }
      resolved_responses?: number
      warnings?: string[]
    }
    const warnings = data.warnings?.length
      ? `\n\n${data.warnings.map((warning) => `Note: ${warning}`).join('\n')}`
      : ''
    const moved =
      typeof data.resolved_responses === 'number'
        ? ` It now resolves ${data.resolved_responses} response(s) already recorded.`
        : ''

    return text(
      `"${data.remap?.raw_normalized ?? raw}" in question "${node_id}" now resolves to ` +
        `${candidate_id}.${moved}\nMapping id ${data.remap?.id} — revoke it with that id if it ` +
        `turns out to be wrong.${warnings}`,
    )
  },
)

// ---------------------------------------------------------------------------

const transport = new StdioServerTransport()
await server.connect(transport)

// Diagnostics go to stderr. stdout is the JSON-RPC channel, and one stray line on it
// desynchronizes the protocol for the rest of the session.
if (!resolveApiKey()) {
  process.stderr.write(
    `humansurvey-mcp: no API key in HUMANSURVEY_API_KEY or ${CREDENTIALS_PATH}\n`,
  )
}
