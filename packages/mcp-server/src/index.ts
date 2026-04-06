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

const API_BASE_URL = process.env.MTS_API_URL ?? 'https://mts.vercel.app'
const API_KEY = process.env.MTS_API_KEY

const server = new McpServer({
  name: 'markdown-to-survey',
  version: '0.1.0',
})

server.registerTool(
  'create_survey',
  {
    title: 'Create Survey',
    description:
      'Create an interactive survey from Markdown or a JSON schema object. Returns a survey URL for respondents and a survey ID for future result lookup.',
    inputSchema: {
      markdown: z.string().min(1).optional(),
      schema: z.record(z.string(), z.unknown()).optional(),
    },
  },
  async ({ markdown, schema }) => {
    const apiKeyError = requireApiKey()
    if (apiKeyError) {
      return apiKeyError
    }

    if (!markdown && !schema) {
      return {
        content: [
          {
            type: 'text',
            text: 'Provide either markdown or schema.',
          },
        ],
        isError: true,
      }
    }

    if (markdown && schema) {
      return {
        content: [
          {
            type: 'text',
            text: 'Provide either markdown or schema, not both.',
          },
        ],
        isError: true,
      }
    }

    const response = await fetch(`${API_BASE_URL}/api/surveys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(schema ? { schema } : { markdown }),
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
      'Get the current results of a survey by its survey ID.',
    inputSchema: {
      survey_id: z.string().min(1),
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
    const surveyPayload = (await surveyResponse.json().catch(() => null)) as
      | {
          id?: string
          title?: string
          responses?: ResponseRecord[]
          error?: string
        }
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
    description: 'List all surveys created with the current API key.',
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
    description: 'Close a survey so it no longer accepts responses.',
    inputSchema: {
      survey_id: z.string().min(1),
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
        text: 'Error: MTS_API_KEY environment variable is not set.\nGet an API key at https://mts.vercel.app or via: POST /api/keys',
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
) {
  const lines = [`Survey: ${title} (${responseCount} responses)`, '']

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
