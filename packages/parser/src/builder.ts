import type {
  Condition,
  MatrixColumn,
  MatrixRow,
  Option,
  Question,
  QuestionInput,
  QuestionType,
  Section,
  SectionInput,
  Survey,
  SurveyInput,
} from './schema.js'

const VALID_QUESTION_TYPES: QuestionType[] = [
  'single_choice',
  'multi_choice',
  'text',
  'matrix',
  'scale',
]

export class SurveyInputValidationError extends Error {
  errors: string[]

  constructor(errors: string[]) {
    super('Invalid schema')
    this.name = 'SurveyInputValidationError'
    this.errors = errors
  }
}

export function buildSurveyFromInput(input: SurveyInput): Survey {
  let questionIndex = 0
  const survey = {
    title: input.title.trim(),
    description: normalizeOptionalString(input.description),
    sections: (input.sections ?? []).map((section, sectionIndex) =>
      buildSection(section, sectionIndex, () => questionIndex++),
    ),
  }

  const errors = validateSurveyInput(input, survey)

  if (errors.length > 0) {
    throw new SurveyInputValidationError(errors)
  }

  return survey
}

function validateSurveyInput(input: SurveyInput, survey: Survey) {
  const errors: string[] = []

  if (!input.title?.trim()) {
    errors.push('title is required')
  }

  if (!Array.isArray(input.sections) || input.sections.length === 0) {
    errors.push('survey must have at least one section')
  }

  ;(input.sections ?? []).forEach((section, sectionIndex) => {
    ;(section.questions ?? []).forEach((question, questionIndex) => {
      const path = `sections[${sectionIndex}].questions[${questionIndex}]`

      if (!question.label?.trim()) {
        errors.push(`${path}.label is required`)
      }

      if (!VALID_QUESTION_TYPES.includes(question.type as QuestionType)) {
        errors.push(`${path}.type '${question.type}' is not a valid question type`)
        return
      }

      if (
        (question.type === 'single_choice' || question.type === 'multi_choice') &&
        (!Array.isArray(question.options) || question.options.length === 0)
      ) {
        errors.push(`${path}.options is required for type '${question.type}'`)
      }

      if (
        question.type === 'matrix' &&
        (!Array.isArray(question.rows) ||
          question.rows.length === 0 ||
          !Array.isArray(question.columns) ||
          question.columns.length === 0)
      ) {
        errors.push(`${path}.rows and columns are required for type 'matrix'`)
      }

      if (question.type === 'scale') {
        if (typeof question.min !== 'number' || typeof question.max !== 'number') {
          errors.push(`${path}.min and max are required for type 'scale'`)
          return
        }

        if (question.min >= question.max) {
          errors.push(`${path}.min must be less than max`)
        }

        if (question.max - question.min + 1 > 11) {
          errors.push(`${path}: scale range cannot exceed 11 points`)
        }
      }

      validateShowIf(errors, survey, question.showIf, path)
    })
  })

  return errors
}

function buildSection(
  section: SectionInput,
  sectionIndex: number,
  nextQuestionIndex: () => number,
): Section {
  return {
    id: `section_${sectionIndex}`,
    title: normalizeOptionalString(section.title),
    description: normalizeOptionalString(section.description),
    questions: (section.questions ?? []).map((question) =>
      buildQuestion(question, nextQuestionIndex()),
    ),
  }
}

function buildQuestion(question: QuestionInput, questionIndex: number): Question {
  const baseQuestion = {
    id: `q_${questionIndex}`,
    type: question.type as QuestionType,
    label: question.label.trim(),
    description: normalizeOptionalString(question.description),
    required: question.required ?? false,
    showIf: question.showIf,
  }

  if (question.type === 'single_choice' || question.type === 'multi_choice') {
    return {
      ...baseQuestion,
      options: (question.options ?? []).map(buildOption),
    }
  }

  if (question.type === 'matrix') {
    const columns = buildMatrixColumns(question.columns ?? [])
    return {
      ...baseQuestion,
      rows: buildMatrixRows(question.rows ?? [], columns),
      columns,
    }
  }

  if (question.type === 'scale') {
    return {
      ...baseQuestion,
      min: question.min,
      max: question.max,
      minLabel: normalizeOptionalString(question.minLabel),
      maxLabel: normalizeOptionalString(question.maxLabel),
    }
  }

  return baseQuestion
}

function buildOption(option: { label: string; hasTextInput?: boolean }, index: number): Option {
  return {
    id: `opt_${index}`,
    label: option.label.trim(),
    hasTextInput: option.hasTextInput,
  }
}

function buildMatrixColumns(columns: QuestionInput['columns']): MatrixColumn[] {
  return (columns ?? []).map((column, columnIndex) => ({
    id: `col_${columnIndex}`,
    label: column.label.trim(),
    options: (column.options ?? []).map(buildOption),
  }))
}

function buildMatrixRows(rows: QuestionInput['rows'], columns: MatrixColumn[]): MatrixRow[] {
  return (rows ?? []).map((row, rowIndex) => ({
    id: `row_${rowIndex}`,
    label: row.label.trim(),
    cells: columns.reduce<Record<string, string>>((accumulator, column) => {
      accumulator[column.id] = ''
      return accumulator
    }, {}),
  }))
}

function normalizeOptionalString(value?: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function validateShowIf(
  errors: string[],
  survey: Survey,
  showIf: Condition | undefined,
  path: string,
) {
  if (!showIf) {
    return
  }

  const questions = survey.sections.flatMap((section) => section.questions)
  const currentQuestion = questions.find((question) => question.showIf === showIf)
  const referencedIndex = questions.findIndex((question) => question.id === showIf.questionId)
  const currentIndex = questions.findIndex((question) => question.id === currentQuestion?.id)

  if (referencedIndex === -1) {
    errors.push(`${path}.showIf.questionId must reference an existing question`)
    return
  }

  if (currentIndex !== -1 && referencedIndex >= currentIndex) {
    errors.push(`${path}.showIf.questionId must reference an earlier question`)
  }

  if (
    (showIf.operator === 'eq' ||
      showIf.operator === 'neq' ||
      showIf.operator === 'contains') &&
    !showIf.value
  ) {
    errors.push(`${path}.showIf.value is required for operator '${showIf.operator}'`)
  }

  if (
    showIf.operator === 'contains' &&
    questions[referencedIndex]?.type !== 'multi_choice'
  ) {
    errors.push(`${path}.showIf.contains requires a multi_choice source question`)
  }
}
