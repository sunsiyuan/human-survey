import { unified } from 'unified'
import remarkParse from 'remark-parse'

export {
  buildSurveyFromInput,
  SurveyInputValidationError,
} from './builder.js'
import type {
  Condition,
  ConditionOperator,
  MatrixColumn,
  MatrixRow,
  MatrixColumnInput,
  MatrixRowInput,
  Option,
  OptionInput,
  Question,
  QuestionInput,
  Survey,
  SurveyInput,
} from './schema.js'

export type {
  Condition,
  ConditionOperator,
  MatrixColumn,
  MatrixColumnInput,
  MatrixRow,
  MatrixRowInput,
  Option,
  OptionInput,
  Question,
  QuestionInput,
  QuestionType,
  Section,
  SectionInput,
  Survey,
  SurveyInput,
} from './schema.js'

type MdNode = {
  type: string
  depth?: number
  value?: string
  children?: MdNode[]
  position?: {
    start: { line: number }
    end: { line: number }
  }
}

type StrongSegment = {
  label: string
  trailing: string
}

const QUESTION_HINT_RE = /^[A-Z]\d+\./i
const MULTI_CHOICE_RE = /可多选|多选|select all|multiple/i
const UNDERSCORE_RE = /_{3,}/
const SCALE_RE = /^\[scale\s+(\d+)-(\d+)(.*)\]$/i
const QUESTION_REF_RE = /^([A-Z]\d+)\./i

export function parseSurvey(markdown: string): Survey {
  if (!markdown.trim()) {
    throw new Error('Markdown input cannot be empty.')
  }

  const tree = unified().use(remarkParse).parse(markdown) as { children?: MdNode[] }
  const nodes = tree.children ?? []
  const lines = markdown.split(/\r?\n/)

  const survey: Survey = {
    title: '',
    sections: [],
  }

  let currentSection: Survey['sections'][number] | undefined
  let currentQuestion: Question | undefined
  let sectionIndex = 0
  let questionIndex = 0
  const questionReferences = new Map<string, string>()

  const ensureSection = () => {
    if (!currentSection) {
      currentSection = {
        id: `section_${sectionIndex++}`,
        questions: [],
      }
      survey.sections.push(currentSection)
    }

    return currentSection
  }

  const createQuestion = (label: string) => {
    const section = ensureSection()
    const question: Question = {
      id: `q_${questionIndex++}`,
      type: 'text',
      label: normalizeWhitespace(label),
      required: !/\boptional\b/i.test(label),
    }

    section.questions.push(question)
    registerQuestionReference(questionReferences, question)
    currentQuestion = question
    return question
  }

  nodes.forEach((node, index) => {
    const nextNode = nodes[index + 1]
    const raw = sliceNode(lines, node)

    switch (node.type) {
      case 'heading': {
        const text = normalizeWhitespace(toPlainText(node))
        if (node.depth === 1) {
          survey.title = text
          currentQuestion = undefined
          return
        }

        if (node.depth === 2) {
          currentSection = {
            id: `section_${sectionIndex++}`,
            title: text,
            questions: [],
          }
          survey.sections.push(currentSection)
          currentQuestion = undefined
        }

        return
      }

      case 'thematicBreak': {
        currentQuestion = undefined
        return
      }

      case 'blockquote': {
        const content = normalizeWhitespace(stripBlockquote(raw))
        if (!content) {
          return
        }

        const condition = currentQuestion
          ? parseCondition(content, questionReferences, currentQuestion.id)
          : null

        if (currentQuestion && condition) {
          currentQuestion.showIf = condition
          return
        }

        if (UNDERSCORE_RE.test(content) && currentQuestion) {
          currentQuestion.type = 'text'
          return
        }

        if (currentQuestion) {
          currentQuestion.description = appendText(currentQuestion.description, content)
          return
        }

        const section = ensureSection()
        section.description = appendText(section.description, content)
        return
      }

      case 'list': {
        const items = (node.children ?? []).map((child) =>
          normalizeWhitespace(toPlainText(child)),
        )
        const checkboxItems = items.filter((item) => item.includes('☐'))

        if (checkboxItems.length > 0 && currentQuestion) {
          setChoiceQuestion(
            currentQuestion,
            checkboxItems.flatMap((item) => parseCheckboxOptions(item)),
          )
          return
        }

        const description = items.filter(Boolean).join('\n')
        if (!description) {
          return
        }

        if (currentQuestion) {
          currentQuestion.description = appendText(currentQuestion.description, description)
          return
        }

        const section = ensureSection()
        section.description = appendText(section.description, description)
        return
      }

      case 'paragraph': {
        const scaleDefinition = currentQuestion
          ? parseScaleDefinition(normalizeWhitespace(toPlainText(node)))
          : null

        if (currentQuestion && scaleDefinition) {
          setScaleQuestion(currentQuestion, scaleDefinition)
          return
        }

        if (looksLikeTable(raw)) {
          const question =
            currentQuestion ??
            createQuestion(currentSection?.title ?? `Question ${questionIndex + 1}`)
          setMatrixQuestion(question, raw)
          return
        }

        const segments = extractStrongSegments(raw)

        if (segments.length > 0) {
          let createdQuestion = false

          segments.forEach((segment) => {
            const strongText = normalizeWhitespace(segment.label)
            const trailing = normalizeWhitespace(segment.trailing)
            const nextRaw = nextNode ? sliceNode(lines, nextNode) : ''

            if (shouldUseAsSurveyDescription(strongText, survey, currentSection)) {
              const description = normalizeWhitespace(
                trailing.replace(UNDERSCORE_RE, '').replace(/\s+/g, ' '),
              )
              if (description) {
                survey.description = appendText(survey.description, description)
              }
              currentQuestion = undefined
              return
            }

            if (isQuestionSegment(strongText, trailing, nextRaw)) {
              const question = createQuestion(buildQuestionLabel(strongText, trailing))
              createdQuestion = true

              if (UNDERSCORE_RE.test(trailing)) {
                question.type = 'text'
              }

              if (trailing.includes('☐')) {
                setChoiceQuestion(question, parseCheckboxOptions(trailing))
              }
            } else {
              const description = normalizeWhitespace(
                [strongText, trailing].filter(Boolean).join(' '),
              )

              if (!description) {
                return
              }

              if (!currentSection) {
                survey.description = appendText(survey.description, description)
              } else if (currentQuestion) {
                currentQuestion.description = appendText(currentQuestion.description, description)
              } else {
                currentSection.description = appendText(currentSection.description, description)
              }
            }
          })

          if (createdQuestion) {
            return
          }
        }

        if (raw.includes('☐') && currentQuestion) {
          setChoiceQuestion(currentQuestion, parseCheckboxOptions(raw))
          return
        }

        const plain = normalizeWhitespace(toPlainText(node))

        if (!plain) {
          return
        }

        if (UNDERSCORE_RE.test(raw) && currentQuestion) {
          currentQuestion.type = 'text'
          return
        }

        if (!currentSection) {
          survey.description = appendText(survey.description, plain)
          return
        }

        if (currentQuestion) {
          currentQuestion.description = appendText(currentQuestion.description, plain)
          return
        }

        currentSection.description = appendText(currentSection.description, plain)
        return
      }

      default:
        return
    }
  })

  if (!survey.title) {
    throw new Error('Survey title is required.')
  }

  return survey
}

function shouldUseAsSurveyDescription(
  strongText: string,
  survey: Survey,
  currentSection: Survey['sections'][number] | undefined,
) {
  return !currentSection && !survey.description && /^instructions:/i.test(strongText)
}

function isQuestionSegment(strongText: string, trailing: string, nextRaw: string) {
  return (
    QUESTION_HINT_RE.test(strongText) ||
    /[?？]/.test(strongText) ||
    UNDERSCORE_RE.test(trailing) ||
    trailing.includes('☐') ||
    UNDERSCORE_RE.test(nextRaw)
  )
}

function buildQuestionLabel(strongText: string, trailing: string) {
  const cleanedTrailing = normalizeWhitespace(
    trailing
      .replace(UNDERSCORE_RE, '')
      .replace(/(?:^|\s)☐.*$/s, '')
      .trim(),
  )

  return cleanedTrailing ? `${strongText} ${cleanedTrailing}` : strongText
}

function setChoiceQuestion(question: Question, options: Option[]) {
  question.type = MULTI_CHOICE_RE.test(question.label) ? 'multi_choice' : 'single_choice'
  question.options = options.map((option, index) => ({
    ...option,
    id: `opt_${index}`,
  }))
  delete question.rows
  delete question.columns
  delete question.min
  delete question.max
  delete question.minLabel
  delete question.maxLabel
}

function setMatrixQuestion(question: Question, rawTable: string) {
  const rows = rawTable
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (rows.length < 3) {
    return
  }

  const header = parsePipeRow(rows[0])
  const dataRows = rows
    .slice(2)
    .map(parsePipeRow)
    .filter((cells) => cells.length === header.length)

  if (dataRows.length === 0) {
    return
  }

  const optionSource = dataRows[0][header.length - 1] ?? ''
  const options = parseCheckboxOptions(optionSource).map((option, index) => ({
    ...option,
    id: `opt_${index}`,
  }))

  const columnId = 'col_0'
  const columns: MatrixColumn[] = [
    {
      id: columnId,
      label: header[header.length - 1] ?? 'Options',
      options,
    },
  ]

  const matrixRows: MatrixRow[] = dataRows.map((cells, index) => {
    const context = cells.slice(0, -1)
    const label =
      normalizeWhitespace(context.slice(1).join(' - ')) ||
      normalizeWhitespace(context.join(' - ')) ||
      `Row ${index + 1}`

    const displayText = context
      .map((cell, cellIndex) => {
        const headerLabel = header[cellIndex]
        if (!headerLabel || headerLabel === '#') {
          return cell
        }

        return `${headerLabel}: ${cell}`
      })
      .filter(Boolean)
      .join(' | ')

    return {
      id: `row_${index}`,
      label,
      cells: {
        [columnId]: normalizeWhitespace(displayText),
      },
    }
  })

  question.type = 'matrix'
  question.rows = matrixRows
  question.columns = columns
  delete question.options
  delete question.min
  delete question.max
  delete question.minLabel
  delete question.maxLabel
}

function setScaleQuestion(
  question: Question,
  scale: {
    min: number
    max: number
    minLabel?: string
    maxLabel?: string
  },
) {
  question.type = 'scale'
  question.min = scale.min
  question.max = scale.max
  question.minLabel = scale.minLabel
  question.maxLabel = scale.maxLabel
  delete question.options
  delete question.rows
  delete question.columns
}

function parseScaleDefinition(input: string) {
  const match = input.match(SCALE_RE)

  if (!match) {
    return null
  }

  const min = Number.parseInt(match[1] ?? '', 10)
  const max = Number.parseInt(match[2] ?? '', 10)

  if (min >= max) {
    throw new Error('Scale min must be less than max')
  }

  if (max - min + 1 > 11) {
    throw new Error('Scale range cannot exceed 11 points')
  }

  const attributes = match[3] ?? ''

  return {
    min,
    max,
    minLabel: extractScaleAttribute(attributes, 'min-label'),
    maxLabel: extractScaleAttribute(attributes, 'max-label'),
  }
}

function extractScaleAttribute(input: string, attributeName: 'min-label' | 'max-label') {
  const match = input.match(new RegExp(`${attributeName}="([^"]*)"`, 'i'))
  return match?.[1]
}

function registerQuestionReference(questionReferences: Map<string, string>, question: Question) {
  const match = question.label.match(QUESTION_REF_RE)
  const reference = match?.[1]?.toUpperCase()

  if (reference) {
    questionReferences.set(reference, question.id)
  }
}

function parseCondition(
  input: string,
  questionReferences: Map<string, string>,
  currentQuestionId: string,
): Condition | null {
  const match = input.match(
    /^show if:\s+(\w+)\s+(=|!=|contains|answered)(?:\s+"([^"]*)")?$/i,
  )

  if (!match) {
    return null
  }

  const questionRef = match[1]?.toUpperCase() ?? ''
  const operatorToken = (match[2] ?? '').toLowerCase()
  const questionId = questionReferences.get(questionRef)

  if (!questionId || questionId === currentQuestionId) {
    throw new Error(`Condition reference '${questionRef}' must refer to an earlier question`)
  }

  return {
    questionId,
    operator: normalizeConditionOperator(operatorToken),
    value: match[3],
  }
}

function normalizeConditionOperator(operatorToken: string): ConditionOperator {
  if (operatorToken === '=') {
    return 'eq'
  }

  if (operatorToken === '!=') {
    return 'neq'
  }

  if (operatorToken === 'contains') {
    return 'contains'
  }

  return 'answered'
}

function parseCheckboxOptions(input: string): Option[] {
  return input
    .replace(/^[^-]*?:\s*(?=☐)/, '')
    .split('☐')
    .slice(1)
    .map((segment) => segment.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((segment) => {
      const hasTextInput = UNDERSCORE_RE.test(segment)
      const label = normalizeWhitespace(segment.replace(UNDERSCORE_RE, '').trim())

      return {
        id: '',
        label,
        ...(hasTextInput ? { hasTextInput: true } : {}),
      }
    })
}

function extractStrongSegments(raw: string): StrongSegment[] {
  const matches = Array.from(raw.matchAll(/\*\*(.+?)\*\*/gs))

  return matches.map((match, index) => {
    const end = match.index! + match[0].length
    const nextStart = matches[index + 1]?.index ?? raw.length

    return {
      label: match[1],
      trailing: raw.slice(end, nextStart),
    }
  })
}

function looksLikeTable(raw: string) {
  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  return (
    rows.length >= 3 &&
    rows[0].startsWith('|') &&
    /^\|?[\s:-]+\|/.test(rows[1]) &&
    rows.some((row) => row.includes('☐'))
  )
}

function parsePipeRow(row: string) {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => normalizeWhitespace(cell))
}

function stripBlockquote(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*>\s?/, ''))
    .join('\n')
}

function appendText(existing: string | undefined, next: string) {
  return existing ? `${existing}\n${next}` : next
}

function sliceNode(lines: string[], node: MdNode) {
  if (!node.position) {
    return ''
  }

  return lines
    .slice(node.position.start.line - 1, node.position.end.line)
    .join('\n')
}

function toPlainText(node: MdNode | undefined): string {
  if (!node) {
    return ''
  }

  if (typeof node.value === 'string') {
    return node.value
  }

  return (node.children ?? []).map(toPlainText).join('')
}

function normalizeWhitespace(input: string) {
  return input.replace(/[ \t\u3000]+/g, ' ').replace(/\n+/g, ' ').trim()
}
