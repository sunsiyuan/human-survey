#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

type Survey = {
  id: string
  title: string
  description?: string
  schema: {
    sections: Array<{
      questions: Array<{
        id: string
        label: string
        type: 'single_choice' | 'multi_choice' | 'text' | 'matrix' | 'composite'
        options?: Array<{ id: string; label: string }>
        rows?: Array<{ id: string; label: string }>
        columns?: Array<{
          id: string
          label: string
          options: Array<{ id: string; label: string }>
        }>
      }>
    }>
  }
}

type ResponseRecord = {
  id: string
  answers: Record<string, string | string[]>
  created_at: string
}

const API_BASE_URL = process.env.MTS_API_URL ?? 'https://mts.vercel.app'

const server = new McpServer({
  name: 'markdown-to-survey',
  version: '0.1.0',
})

server.registerTool(
  'create_survey',
  {
    title: 'Create Survey',
    description:
      'Create an interactive survey from a Markdown string. Returns a survey URL for respondents and a results URL for the survey creator.',
    inputSchema: {
      markdown: z.string().min(1),
    },
  },
  async ({ markdown }) => {
    const response = await fetch(`${API_BASE_URL}/api/surveys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown }),
    })

    const payload = (await response.json().catch(() => null)) as
      | {
          survey_url?: string
          results_url?: string
          question_count?: number
          error?: string
        }
      | null

    if (!response.ok || !payload?.survey_url || !payload.results_url) {
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
          text: `Survey created successfully!\n\nSurvey URL (share with respondents): ${payload.survey_url}\nResults URL (view responses): ${payload.results_url}\n\nQuestions: ${payload.question_count ?? 0}`,
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
      'Get the current results of a survey by its result ID (from the results URL).',
    inputSchema: {
      result_id: z.string().min(1),
    },
  },
  async ({ result_id: resultId }) => {
    const surveyResponse = await fetch(
      `${API_BASE_URL}/api/surveys/by-result/${encodeURIComponent(resultId)}`,
    )
    const surveyPayload = (await surveyResponse.json().catch(() => null)) as
      | {
          survey_id?: string
          title?: string
          description?: string
          schema?: Survey['schema']
          responses?: ResponseRecord[]
          error?: string
        }
      | null

    if (!surveyResponse.ok || !surveyPayload?.survey_id || !surveyPayload.schema) {
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
      `${API_BASE_URL}/api/surveys/${encodeURIComponent(surveyPayload.survey_id)}/responses`,
    )
    const responsesPayload = (await responsesResponse.json().catch(() => null)) as
      | {
          count?: number
          responses?: ResponseRecord[]
          error?: string
        }
      | null

    if (!responsesResponse.ok || !responsesPayload?.responses) {
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
      surveyPayload.schema,
      responsesPayload.responses,
      responsesPayload.count ?? responsesPayload.responses.length,
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

await server.connect(new StdioServerTransport())

function formatResultsSummary(
  title: string,
  schema: Survey['schema'],
  responses: ResponseRecord[],
  responseCount: number,
) {
  const lines = [`${title}`, `Responses: ${responseCount}`, '']

  schema.sections.forEach((section) => {
    section.questions.forEach((question) => {
      lines.push(`${question.label}`)

      if (question.type === 'text') {
        const textValues = responses
          .map((response) => response.answers[question.id])
          .filter((answer): answer is string => typeof answer === 'string' && answer.length > 0)
          .slice(0, 5)

        if (textValues.length === 0) {
          lines.push('- No text responses yet')
        } else {
          textValues.forEach((value) => {
            lines.push(`- ${value}`)
          })
        }
      } else if (question.type === 'matrix') {
        const options = question.columns?.[0]?.options ?? []
        const rowCounts = (question.rows ?? []).map((row) => {
          const counts = new Map(options.map((option) => [option.id, 0]))

          responses.forEach((response) => {
            const answer = response.answers[question.id]
            const values = Array.isArray(answer) ? answer : []

            values.forEach((entry) => {
              const [rowId, optionId] = entry.split(':')
              if (rowId === row.id && counts.has(optionId)) {
                counts.set(optionId, (counts.get(optionId) ?? 0) + 1)
              }
            })
          })

          const summary = options
            .map((option) => `${option.label}: ${counts.get(option.id) ?? 0}`)
            .join(', ')

          return `- ${row.label}: ${summary}`
        })

        lines.push(...rowCounts)
      } else {
        const counts = new Map((question.options ?? []).map((option) => [option.id, 0]))

        responses.forEach((response) => {
          const answer = response.answers[question.id]
          const values = Array.isArray(answer) ? answer : typeof answer === 'string' ? [answer] : []

          values.forEach((value) => {
            const optionId = value.split('::')[0] ?? ''
            if (counts.has(optionId)) {
              counts.set(optionId, (counts.get(optionId) ?? 0) + 1)
            }
          })
        })

        ;(question.options ?? []).forEach((option) => {
          lines.push(`- ${option.label}: ${counts.get(option.id) ?? 0}`)
        })
      }

      lines.push('')
    })
  })

  return lines
}
