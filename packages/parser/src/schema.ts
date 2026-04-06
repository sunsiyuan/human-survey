export interface Survey {
  title: string
  description?: string
  sections: Section[]
}

export interface SurveyInput {
  title: string
  description?: string
  sections: SectionInput[]
}

export interface Section {
  id: string
  title?: string
  description?: string
  questions: Question[]
}

export interface SectionInput {
  title?: string
  description?: string
  questions: QuestionInput[]
}

export type ConditionOperator = 'eq' | 'neq' | 'contains' | 'answered'

export interface Condition {
  questionId: string
  operator: ConditionOperator
  value?: string
}

export type QuestionType =
  | 'single_choice'
  | 'multi_choice'
  | 'text'
  | 'matrix'
  | 'scale'

export interface Question {
  id: string
  type: QuestionType
  label: string
  description?: string
  required: boolean
  showIf?: Condition
  options?: Option[]
  rows?: MatrixRow[]
  columns?: MatrixColumn[]
  min?: number
  max?: number
  minLabel?: string
  maxLabel?: string
}

export interface QuestionInput {
  type: QuestionType | string
  label: string
  description?: string
  required?: boolean
  showIf?: Condition
  options?: OptionInput[]
  rows?: MatrixRowInput[]
  columns?: MatrixColumnInput[]
  min?: number
  max?: number
  minLabel?: string
  maxLabel?: string
}

export interface Option {
  id: string
  label: string
  hasTextInput?: boolean
}

export interface OptionInput {
  label: string
  hasTextInput?: boolean
}

export interface MatrixRow {
  id: string
  label: string
  cells: { [columnId: string]: string }
}

export interface MatrixRowInput {
  label: string
}

export interface MatrixColumn {
  id: string
  label: string
  options: Option[]
}

export interface MatrixColumnInput {
  label: string
  options: OptionInput[]
}
