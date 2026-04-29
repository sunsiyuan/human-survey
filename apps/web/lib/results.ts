import type { PublicCompletionReason } from '@/lib/lifecycle'
import type { MatrixColumn, MatrixRow, Option, Question, Survey } from '@/lib/survey'

export type ResponseAnswerValue = string | string[] | number

export type ResponseRecord = {
  id: string
  survey_id?: string
  answers: Record<string, ResponseAnswerValue>
  created_at: string
}

type ResultsQuestionBase = {
  id: string
  label: string
  description?: string
}

export type ChoiceResultsQuestion = ResultsQuestionBase & {
  type: 'single_choice' | 'multi_choice'
  options: Option[]
  tally: Record<string, number>
}

export type TextResultsQuestion = ResultsQuestionBase & {
  type: 'text'
  responses: Array<{
    value: string
    created_at: string
  }>
}

export type MatrixResultsQuestion = ResultsQuestionBase & {
  type: 'matrix'
  rows: MatrixRow[]
  columns: MatrixColumn[]
  tally: Record<string, Record<string, number>>
}

export type ScaleResultsQuestion = ResultsQuestionBase & {
  type: 'scale'
  min: number
  max: number
  minLabel?: string
  maxLabel?: string
  stats: {
    count: number
    mean: number
    median: number
    distribution: Record<string, number>
  }
}

export type ResultsQuestion =
  | ChoiceResultsQuestion
  | TextResultsQuestion
  | MatrixResultsQuestion
  | ScaleResultsQuestion

export type AggregatedSurveyResults = {
  count: number
  questions: ResultsQuestion[]
  raw: ResponseRecord[]
  is_final: boolean
  completion_reason: PublicCompletionReason | null
  next_check_hint_seconds: number | null
  next_cursor: string | null
}

export function aggregateSurveyResults(
  survey: Survey,
  responses: ResponseRecord[],
): Omit<
  AggregatedSurveyResults,
  'is_final' | 'completion_reason' | 'next_check_hint_seconds' | 'next_cursor'
> {
  return {
    count: responses.length,
    questions: survey.sections.flatMap((section) =>
      section.questions.map((question) => aggregateQuestion(question, responses)),
    ),
    raw: responses,
  }
}

export function buildResultsPayload(args: {
  survey: Survey
  allResponses: ResponseRecord[]
  filteredRaw: ResponseRecord[]
  isFinal: boolean
  completionReason: PublicCompletionReason | null
  nextCheckHintSeconds: number | null
}): AggregatedSurveyResults {
  const aggregated = aggregateSurveyResults(args.survey, args.allResponses)
  return {
    ...aggregated,
    raw: args.filteredRaw,
    is_final: args.isFinal,
    completion_reason: args.completionReason,
    next_check_hint_seconds: args.nextCheckHintSeconds,
    // next_cursor is the id of the newest response in the full set, not the filtered set.
    // null iff the survey has zero responses. When the caller's since_response_id already
    // matches the newest response, next_cursor equals the input cursor (steady state).
    next_cursor: args.allResponses[0]?.id ?? null,
  }
}

// Advisory cadence for the next get_results call. Caller may check sooner; this is just a server-side hint
// based on observed response rate and time-to-expiry. null when no further check is useful (is_final true,
// or expiry already passed).
export function computeNextCheckHintSeconds(args: {
  isFinal: boolean
  expiresAt: string | null
  recentResponses1h: number
}): number | null {
  if (args.isFinal) return null

  const now = Date.now()
  const remainingMs = args.expiresAt
    ? new Date(args.expiresAt).getTime() - now
    : Number.POSITIVE_INFINITY

  if (remainingMs <= 0) return null

  let baseSec: number
  if (args.recentResponses1h >= 6) baseSec = 300
  else if (args.recentResponses1h >= 1) baseSec = 600
  else baseSec = 1800

  if (!Number.isFinite(remainingMs)) return baseSec

  const remainingSec = Math.floor(remainingMs / 1000)
  const expiryCap = Math.max(60, Math.floor(remainingSec / 4))
  return Math.min(baseSec, expiryCap)
}

function aggregateQuestion(question: Question, responses: ResponseRecord[]): ResultsQuestion {
  if (question.type === 'text') {
    return {
      id: question.id,
      type: 'text',
      label: question.label,
      description: question.description,
      responses: responses
        .map((response) => ({
          value: response.answers[question.id],
          created_at: response.created_at,
        }))
        .filter(
          (
            entry,
          ): entry is {
            value: string
            created_at: string
          } => typeof entry.value === 'string' && entry.value.trim().length > 0,
        )
        .slice(0, 20),
    }
  }

  if (question.type === 'scale') {
    const min = question.min ?? 0
    const max = question.max ?? 0
    const values = responses
      .map((response) => response.answers[question.id])
      .filter((value): value is number => typeof value === 'number')
      .sort((left, right) => left - right)
    const distribution = Array.from({ length: max - min + 1 }, (_, offset) => min + offset).reduce<
      Record<string, number>
    >((accumulator, point) => {
      accumulator[String(point)] = 0
      return accumulator
    }, {})

    values.forEach((value) => {
      const key = String(value)
      if (typeof distribution[key] === 'number') {
        distribution[key] += 1
      }
    })

    return {
      id: question.id,
      type: 'scale',
      label: question.label,
      description: question.description,
      min,
      max,
      minLabel: question.minLabel,
      maxLabel: question.maxLabel,
      stats: {
        count: values.length,
        mean:
          values.length === 0
            ? 0
            : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)),
        median: values.length === 0 ? 0 : calculateMedian(values),
        distribution,
      },
    }
  }

  if (question.type === 'matrix') {
    const columns = question.columns ?? []
    const rows = question.rows ?? []
    const options = columns[0]?.options ?? []
    const tally = rows.reduce<Record<string, Record<string, number>>>((rowAccumulator, row) => {
      rowAccumulator[row.id] = options.reduce<Record<string, number>>(
        (optionAccumulator, option) => {
          optionAccumulator[option.id] = 0
          return optionAccumulator
        },
        {},
      )
      return rowAccumulator
    }, {})

    responses.forEach((response) => {
      const answer = response.answers[question.id]
      const values = Array.isArray(answer) ? answer : []

      values.forEach((entry) => {
        const [rowId, optionId] = entry.split(':')
        if (!rowId || !optionId || typeof tally[rowId]?.[optionId] !== 'number') {
          return
        }

        tally[rowId][optionId] += 1
      })
    })

    return {
      id: question.id,
      type: 'matrix',
      label: question.label,
      description: question.description,
      rows,
      columns,
      tally,
    }
  }

  const options = question.options ?? []
  const tally = options.reduce<Record<string, number>>((accumulator, option) => {
    accumulator[option.id] = 0
    return accumulator
  }, {})

  responses.forEach((response) => {
    const answer = response.answers[question.id]
    const values = Array.isArray(answer) ? answer : typeof answer === 'string' ? [answer] : []

    values.forEach((entry) => {
      const optionId = entry.split('::')[0] ?? ''
      if (typeof tally[optionId] === 'number') {
        tally[optionId] += 1
      }
    })
  })

  if (question.type !== 'single_choice' && question.type !== 'multi_choice') {
    throw new Error(`Unsupported question type in results aggregation: ${question.type}`)
  }

  return {
    id: question.id,
    type: question.type,
    label: question.label,
    description: question.description,
    options,
    tally,
  }
}

function calculateMedian(values: number[]) {
  const middleIndex = Math.floor(values.length / 2)

  if (values.length % 2 === 1) {
    return values[middleIndex] ?? 0
  }

  const left = values[middleIndex - 1] ?? 0
  const right = values[middleIndex] ?? 0
  return Number(((left + right) / 2).toFixed(1))
}
