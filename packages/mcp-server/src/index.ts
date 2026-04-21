#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

type ResponseRecord = {
  id: string
  answers: Record<string, string | string[] | number>
  created_at: string
}

type SurveyListItem = {
  id: string
  title: string
  status?: string
  response_count?: number
  created_at?: string
}

type SurveyMetadata = {
  id?: string
  title?: string
  status?: string
  response_count?: number
  max_responses?: number | null
  error?: string
}

type ResultsQuestion =
  | {
      id: string
      type: 'single_choice' | 'multi_choice'
      label: string
      options: Array<{ id: string; label: string }>
      tally: Record<string, number>
    }
  | {
      id: string
      type: 'text'
      label: string
      responses: Array<{ value: string; created_at: string }>
    }
  | {
      id: string
      type: 'matrix'
      label: string
      rows: Array<{ id: string; label: string }>
      columns: Array<{
        id: string
        label: string
        options: Array<{ id: string; label: string }>
      }>
      tally: Record<string, Record<string, number>>
    }
  | {
      id: string
      type: 'scale'
      label: string
      min: number
      max: number
      stats: {
        count: number
        mean: number
        median: number
        distribution: Record<string, number>
      }
    }

const API_BASE_URL = process.env.HUMANSURVEY_API_URL ?? 'https://www.humansurvey.co'

const ConditionSchema = z.object({
  questionId: z
    .string()
    .describe(
      'ID of the earlier question to check. IDs are assigned in order of appearance as q_0, q_1, q_2, ... across all sections. Must reference a question before the one where showIf is set.',
    ),
  operator: z
    .enum(['eq', 'neq', 'contains', 'answered'])
    .describe(
      'eq = referenced answer equals value; neq = not equal; contains = multi_choice selection includes value; answered = respondent gave any answer.',
    ),
  value: z
    .string()
    .optional()
    .describe(
      'Option ID (opt_0, opt_1, ...) for eq/neq/contains — numbered per-question in option order. Omit for the answered operator.',
    ),
})

const OptionSchema = z.object({
  label: z.string().describe('Option text shown to the respondent.'),
  hasTextInput: z
    .boolean()
    .optional()
    .describe('Set true for an "Other: ___" option that lets the respondent type a free-text value.'),
})

const MatrixRowSchema = z.object({
  label: z.string().describe('Row label — usually an item or criterion being evaluated.'),
})

const MatrixColumnSchema = z.object({
  label: z.string().describe('Column label.'),
  options: z
    .array(OptionSchema)
    .min(1)
    .describe('Options shown in each cell of this column. Every row uses the same column options.'),
})

const BaseQuestionFields = {
  label: z.string().describe('Question text shown to the respondent.'),
  description: z.string().optional().describe('Optional helper text shown under the question label.'),
  required: z
    .boolean()
    .optional()
    .describe('Whether an answer is required. Defaults to false.'),
  showIf: ConditionSchema.optional().describe(
    'Only show this question if the condition on an earlier question is met.',
  ),
}

const SingleChoiceQuestionSchema = z.object({
  type: z.literal('single_choice'),
  ...BaseQuestionFields,
  options: z
    .array(OptionSchema)
    .min(1)
    .describe('Options the respondent chooses exactly one of.'),
})

const MultiChoiceQuestionSchema = z.object({
  type: z.literal('multi_choice'),
  ...BaseQuestionFields,
  options: z
    .array(OptionSchema)
    .min(1)
    .describe('Options the respondent can pick one or more of.'),
})

const TextQuestionSchema = z.object({
  type: z.literal('text'),
  ...BaseQuestionFields,
})

const ScaleQuestionSchema = z.object({
  type: z.literal('scale'),
  ...BaseQuestionFields,
  min: z.number().int().describe('Lowest scale value (usually 0 or 1).'),
  max: z
    .number()
    .int()
    .describe('Highest scale value. The range (max - min + 1) must be ≤ 11.'),
  minLabel: z.string().optional().describe('Label shown at the min end, e.g. "Not likely".'),
  maxLabel: z.string().optional().describe('Label shown at the max end, e.g. "Very likely".'),
})

const MatrixQuestionSchema = z.object({
  type: z.literal('matrix'),
  ...BaseQuestionFields,
  rows: z
    .array(MatrixRowSchema)
    .min(1)
    .describe('Rows of the matrix — usually items or criteria being evaluated.'),
  columns: z
    .array(MatrixColumnSchema)
    .min(1)
    .describe('Columns of the matrix — each column defines the options used for every row.'),
})

const QuestionSchema = z.discriminatedUnion('type', [
  SingleChoiceQuestionSchema,
  MultiChoiceQuestionSchema,
  TextQuestionSchema,
  ScaleQuestionSchema,
  MatrixQuestionSchema,
])

const SectionSchema = z.object({
  title: z.string().optional().describe('Optional section heading.'),
  description: z.string().optional().describe('Optional section description.'),
  questions: z.array(QuestionSchema).min(1).describe('Questions in this section.'),
})

const SurveyInputSchema = z.object({
  title: z.string().describe('Survey title shown to respondents on the welcome screen.'),
  description: z
    .string()
    .optional()
    .describe('Optional intro text shown on the welcome screen.'),
  sections: z
    .array(SectionSchema)
    .min(1)
    .describe('Survey sections, each with questions. Use a single section for simple surveys.'),
})

const server = new McpServer({
  name: 'humansurvey-mcp',
  version: '0.3.1',
})

server.registerTool(
  'create_key',
  {
    title: 'Create API Key',
    description:
      'Create a new HumanSurvey API key. ' +
      'Call this before any other tool if HUMANSURVEY_API_KEY is not set. ' +
      'Returns a key — store it as HUMANSURVEY_API_KEY in your MCP config. ' +
      'The key cannot be retrieved again after creation.',
    inputSchema: {
      name: z.string().optional().describe('A label for this key, e.g. the project or agent name.'),
      email: z.string().email().optional().describe('Contact email of the human owner. Used for billing and usage notifications in the future.'),
      wallet_address: z.string().optional().describe('Optional wallet address in CAIP-10 format (e.g. "eip155:8453:0xabc..." for Base, "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:ABC..." for Solana). Will be used for agent-native payments in the future.'),
    },
  },
  async ({ name, email, wallet_address }) => {
    const response = await fetch(`${API_BASE_URL}/api/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name ?? null,
        email: email ?? null,
        wallet_address: wallet_address ?? null,
        agent_client: (() => {
          const info = server.server.getClientVersion()
          return info ? `${info.name}/${info.version}` : 'mcp'
        })(),
      }),
    })

    const payload = (await response.json().catch(() => null)) as
      | { id?: string; key?: string; error?: string }
      | null

    if (!response.ok || !payload?.key) {
      return {
        content: [{ type: 'text', text: `Failed to create API key: ${payload?.error ?? response.statusText}` }],
        isError: true,
      }
    }

    process.env.HUMANSURVEY_API_KEY = payload.key

    return {
      content: [
        {
          type: 'text',
          text: `API key created!\n\nKey: ${payload.key}\n\nThis key is now active for this session. Save it as HUMANSURVEY_API_KEY in your MCP config so it persists across restarts — it cannot be retrieved again.`,
        },
      ],
    }
  },
)

server.registerTool(
  'create_survey',
  {
    title: 'Create Survey',
    description:
      'Use this when an agent task involves collecting structured feedback or data from a group of people. ' +
      'Common cases: post-event attendee feedback, product satisfaction after a launch, team health checks, customer ratings after support resolution. ' +
      'The schema parameter is fully typed — follow the field types rather than guessing. ' +
      'Returns a survey_url to share with respondents and a survey_id to pass to get_results later. ' +
      'The survey accepts responses immediately and stays open until you close it or it expires.',
    inputSchema: {
      schema: SurveyInputSchema.describe(
        'Survey definition. Each question is a discriminated union keyed by type: single_choice, multi_choice, text, scale, or matrix. Use the typed fields below — do not send free-form JSON.',
      ),
      max_responses: z.number().int().positive().optional().describe(
        'Optional. Close the survey automatically after this many responses.'
      ),
      expires_at: z.string().optional().describe(
        'Optional. ISO 8601 datetime — close the survey automatically at this time (e.g. "2026-04-14T00:00:00Z").'
      ),
      webhook_url: z.string().url().optional().describe(
        'Optional. URL to POST to once when the survey closes. ' +
        'Payload: { survey_id, status: "closed", closed_reason: "manual" | "max_responses", response_count, closed_at }. ' +
        'Fires when you call close_survey or when max_responses is reached. Does not fire when expires_at elapses.'
      ),
    },
  },
  async ({ schema, max_responses, expires_at, webhook_url }) => {
    const apiKeyError = requireApiKey()
    if (apiKeyError) {
      return apiKeyError
    }

    const response = await fetch(`${API_BASE_URL}/api/surveys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.HUMANSURVEY_API_KEY}`,
      },
      body: JSON.stringify({ schema, max_responses, expires_at, webhook_url }),
    })

    const payload = (await response.json().catch(() => null)) as
      | {
          survey_url?: string
          question_count?: number
          error?: string
        }
      | null

    if (!response.ok || !payload?.survey_url) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to create survey: ${payload?.error ?? response.statusText}`,
          },
        ],
        isError: true,
      }
    }

    const surveyUrl = payload.survey_url.startsWith('http')
      ? payload.survey_url
      : `${API_BASE_URL}${payload.survey_url.startsWith('/') ? '' : '/'}${payload.survey_url}`

    return {
      content: [
        {
          type: 'text',
          text: `Survey created successfully!\n\nSurvey URL (share with respondents): ${surveyUrl}\nSurvey ID (for get_results): ${extractSurveyId(surveyUrl)}\n\nQuestions: ${payload.question_count ?? 0}`,
        },
      ],
    }
  },
)

server.registerTool(
  'get_results',
  {
    title: 'Get Results',
    description:
      'Retrieve aggregated results for a survey. ' +
      'Shows survey status (open/closed), total response count, and per-question results: ' +
      'choice tallies with percentages, scale mean/median/distribution, and recent text responses. ' +
      'If the survey is still open, call again later to check for new responses — the output will tell you. ' +
      'Use close_survey when you have enough responses.',
    inputSchema: {
      survey_id: z.string().min(1).describe('The survey ID from the create_survey output (last segment of the survey_url, e.g. "abc123efgh45")'),
    },
  },
  async ({ survey_id: surveyId }) => {
    const apiKeyError = requireApiKey()
    if (apiKeyError) {
      return apiKeyError
    }

    const surveyResponse = await fetch(
      `${API_BASE_URL}/api/surveys/${encodeURIComponent(surveyId)}`,
    )
    const surveyPayload = (await surveyResponse.json().catch(() => null)) as SurveyMetadata | null

    if (!surveyResponse.ok || !surveyPayload?.id) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to fetch survey: ${surveyPayload?.error ?? surveyResponse.statusText}`,
          },
        ],
        isError: true,
      }
    }

    const responsesResponse = await fetch(
      `${API_BASE_URL}/api/surveys/${encodeURIComponent(surveyId)}/responses`,
      {
        headers: {
          Authorization: `Bearer ${process.env.HUMANSURVEY_API_KEY}`,
        },
      },
    )
    const responsesPayload = (await responsesResponse.json().catch(() => null)) as
      | {
          count?: number
          questions?: ResultsQuestion[]
          raw?: ResponseRecord[]
          error?: string
        }
      | null

    if (!responsesResponse.ok || !responsesPayload?.questions) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to fetch responses: ${responsesPayload?.error ?? responsesResponse.statusText}`,
          },
        ],
        isError: true,
      }
    }

    const lines = formatResultsSummary(
      surveyPayload.title ?? 'Survey results',
      responsesPayload.questions,
      responsesPayload.count ?? responsesPayload.raw?.length ?? 0,
      surveyPayload.status,
      surveyPayload.max_responses ?? null,
    )

    return {
      content: [
        {
          type: 'text',
          text: lines.join('\n'),
        },
      ],
    }
  },
)

server.registerTool(
  'list_surveys',
  {
    title: 'List Surveys',
    description: 'List all surveys created with the current API key, ordered newest first. Use this to find a survey_id you need for get_results or close_survey, or to check which surveys are still open.',
    inputSchema: {},
  },
  async () => {
    const apiKeyError = requireApiKey()
    if (apiKeyError) {
      return apiKeyError
    }

    const response = await fetch(`${API_BASE_URL}/api/surveys`, {
      headers: {
        Authorization: `Bearer ${process.env.HUMANSURVEY_API_KEY}`,
      },
    })
    const payload = (await response.json().catch(() => null)) as
      | SurveyListItem[]
      | { error?: string }
      | null

    if (!response.ok || !Array.isArray(payload)) {
      const error = payload && !Array.isArray(payload) ? payload.error : response.statusText
      return {
        content: [
          {
            type: 'text',
            text: `Failed to list surveys: ${error ?? response.statusText}`,
          },
        ],
        isError: true,
      }
    }

    if (payload.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No surveys found for this API key.',
          },
        ],
      }
    }

    const lines = ['ID          Title                    Status   Responses  Created']

    payload.forEach((survey) => {
      lines.push(
        [
          survey.id.padEnd(10),
          truncate(survey.title, 24).padEnd(24),
          (survey.status ?? 'open').padEnd(8),
          String(survey.response_count ?? 0).padEnd(10),
          (survey.created_at ?? '').slice(0, 10),
        ].join('  '),
      )
    })

    return {
      content: [
        {
          type: 'text',
          text: lines.join('\n'),
        },
      ],
    }
  },
)

server.registerTool(
  'close_survey',
  {
    title: 'Close Survey',
    description: 'Permanently close a survey so it no longer accepts new responses. Use this when you have enough responses or the data collection window has passed. Returns the final response count. Closing is irreversible via MCP — use PATCH /api/surveys/{id} to re-open.',
    inputSchema: {
      survey_id: z.string().min(1).describe('The survey ID to close'),
    },
  },
  async ({ survey_id: surveyId }) => {
    const apiKeyError = requireApiKey()
    if (apiKeyError) {
      return apiKeyError
    }

    const surveyResponse = await fetch(`${API_BASE_URL}/api/surveys/${encodeURIComponent(surveyId)}`)
    const surveyPayload = (await surveyResponse.json().catch(() => null)) as
      | { id?: string; title?: string; error?: string }
      | null

    if (!surveyResponse.ok || !surveyPayload?.id) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to fetch survey: ${surveyPayload?.error ?? surveyResponse.statusText}`,
          },
        ],
        isError: true,
      }
    }

    const closeResponse = await fetch(`${API_BASE_URL}/api/surveys/${encodeURIComponent(surveyId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.HUMANSURVEY_API_KEY}`,
      },
      body: JSON.stringify({ status: 'closed' }),
    })
    const closePayload = (await closeResponse.json().catch(() => null)) as
      | { id?: string; error?: string }
      | null

    if (!closeResponse.ok || !closePayload?.id) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to close survey: ${closePayload?.error ?? closeResponse.statusText}`,
          },
        ],
        isError: true,
      }
    }

    const resultsResponse = await fetch(
      `${API_BASE_URL}/api/surveys/${encodeURIComponent(surveyId)}/responses`,
      {
        headers: {
          Authorization: `Bearer ${process.env.HUMANSURVEY_API_KEY}`,
        },
      },
    )
    const resultsPayload = (await resultsResponse.json().catch(() => null)) as
      | { count?: number; error?: string }
      | null

    if (!resultsResponse.ok) {
      return {
        content: [
          {
            type: 'text',
            text: `Survey '${surveyPayload.title ?? surveyId}' closed.`,
          },
        ],
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `Survey '${surveyPayload.title ?? surveyId}' closed. Total responses received: ${resultsPayload?.count ?? 0}`,
        },
      ],
    }
  },
)

await server.connect(new StdioServerTransport())

function requireApiKey() {
  if (process.env.HUMANSURVEY_API_KEY) {
    return null
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: 'No API key found. Call the create_key tool first — it takes no arguments and will provision a key immediately. The key will be active for this session and you can then proceed with create_survey.',
      },
    ],
    isError: true,
  }
}

function extractSurveyId(surveyUrl: string) {
  const trimmed = surveyUrl.replace(/\/+$/, '')
  const segments = trimmed.split('/')
  return segments[segments.length - 1] ?? surveyUrl
}

function formatResultsSummary(
  title: string,
  questions: ResultsQuestion[],
  responseCount: number,
  status?: string,
  maxResponses?: number | null,
) {
  const countLabel =
    maxResponses != null
      ? `${responseCount}/${maxResponses} responses`
      : `${responseCount} response${responseCount !== 1 ? 's' : ''}`

  const statusLabel = status === 'closed' ? 'closed' : 'open'

  const collectionStatus =
    status === 'closed'
      ? 'Collection complete.'
      : maxResponses != null && responseCount >= maxResponses
        ? 'Collection complete (max responses reached).'
        : 'Still collecting — call get_results again to check for new responses.'

  const lines = [`Survey: ${title} | Status: ${statusLabel} | ${countLabel}`, collectionStatus, '']

  questions.forEach((question, index) => {
    lines.push(`Q${index}. (${question.type}) ${question.label}`)

    if (question.type === 'text') {
      const textResponses = question.responses.slice(0, 5)

      if (textResponses.length === 0) {
        lines.push('  No text responses yet')
      } else {
        textResponses.forEach((response) => {
          lines.push(`  "${response.value}" (${response.created_at.slice(0, 10)})`)
        })

        if (question.responses.length > textResponses.length) {
          lines.push(`  ... and ${question.responses.length - textResponses.length} more`)
        }
      }

      lines.push('')
      return
    }

    if (question.type === 'matrix') {
      const options = question.columns[0]?.options ?? []

      question.rows.forEach((row) => {
        const summary = options
          .map((option) => `${option.label}: ${question.tally[row.id]?.[option.id] ?? 0}`)
          .join(', ')
        lines.push(`  ${row.label}: ${summary}`)
      })

      lines.push('')
      return
    }

    if (question.type === 'scale') {
      lines.push(
        `  Mean: ${question.stats.mean} | Median: ${question.stats.median} | Responses: ${question.stats.count}`,
      )
      lines.push(`  Distribution: ${formatScaleDistribution(question.stats.distribution)}`)
      lines.push('')
      return
    }

    const totalSelections = Object.values(question.tally).reduce((sum, count) => sum + count, 0)

    question.options.forEach((option) => {
      const count = question.tally[option.id] ?? 0
      const percentage =
        totalSelections === 0 ? 0 : Number(((count / totalSelections) * 100).toFixed(1))
      lines.push(`  ${option.label}: ${count} (${percentage}%)`)
    })

    lines.push('')
  })

  return lines
}

function formatScaleDistribution(distribution: Record<string, number>) {
  const entries = Object.entries(distribution)
  const maxCount = Math.max(...entries.map(([, count]) => count), 0)

  return entries
    .map(([value, count]) => `${value}${count === 0 ? '▁' : scaleBlock(count, maxCount)}`)
    .join(' ')
}

function scaleBlock(count: number, maxCount: number) {
  if (maxCount === 0 || count <= 0) {
    return '▁'
  }

  const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
  const index = Math.max(1, Math.ceil((count / maxCount) * (blocks.length - 1)))
  return blocks[index] ?? '█'
}

function truncate(value: string, length: number) {
  if (value.length <= length) {
    return value
  }

  return `${value.slice(0, length - 1)}…`
}
