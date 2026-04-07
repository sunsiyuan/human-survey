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

const API_BASE_URL = process.env.MTS_API_URL ?? 'https://www.humansurvey.co'
const API_KEY = process.env.MTS_API_KEY

const server = new McpServer({
  name: 'humansurvey-mcp',
  version: '0.1.0',
})

server.registerTool(
  'create_survey',
  {
    title: 'Create Survey',
    description:
      'Use this when an agent task involves collecting structured feedback or data from a group of people. ' +
      'Common cases: post-event attendee feedback, product satisfaction after a launch, team health checks, customer ratings after support resolution. ' +
      'Provide a JSON schema object describing the survey. ' +
      'Returns a survey_url to share with respondents and a survey_id to pass to get_results later. ' +
      'The survey accepts responses immediately and stays open until you close it or it expires.',
    inputSchema: {
      schema: z.record(z.string(), z.unknown()).describe(
        'Survey as a JSON schema object: { title: string, sections: [{ questions: [{ type, label, ...}] }] }. ' +
        'Question types: single_choice (needs options), multi_choice (needs options), text, scale (needs min/max, range ≤ 11), matrix (needs rows + columns). ' +
        'Add showIf: { questionId, operator: "eq"|"neq"|"contains"|"answered", value } to any question for conditional logic.'
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
        Authorization: `Bearer ${API_KEY}`,
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

    return {
      content: [
        {
          type: 'text',
          text: `Survey created successfully!\n\nSurvey URL (share with respondents): ${payload.survey_url}\nSurvey ID (for get_results): ${extractSurveyId(payload.survey_url)}\n\nQuestions: ${payload.question_count ?? 0}`,
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
          Authorization: `Bearer ${API_KEY}`,
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
        Authorization: `Bearer ${API_KEY}`,
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
        Authorization: `Bearer ${API_KEY}`,
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
          Authorization: `Bearer ${API_KEY}`,
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
  if (API_KEY) {
    return null
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: 'Error: MTS_API_KEY environment variable is not set.\nGet an API key at https://www.humansurvey.co or via: POST /api/keys',
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
