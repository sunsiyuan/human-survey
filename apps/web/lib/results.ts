import type { MatrixColumn, MatrixRow, Option, Question, Survey } from '@mts/parser'

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

export type ResultsQuestion =
  | ChoiceResultsQuestion
  | TextResultsQuestion
  | MatrixResultsQuestion

export type AggregatedSurveyResults = {
  count: number
  questions: ResultsQuestion[]
  raw: ResponseRecord[]
}

export function aggregateSurveyResults(
  survey: Survey,
  responses: ResponseRecord[],
): AggregatedSurveyResults {
  return {
    count: responses.length,
    questions: survey.sections.flatMap((section) =>
      section.questions.map((question) => aggregateQuestion(question, responses)),
    ),
    raw: responses,
  }
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
