export interface Survey {
  title: string
  description?: string
  sections: Section[]
}

export interface Section {
  id: string
  title?: string
  description?: string
  questions: Question[]
}

export type QuestionType =
  | 'single_choice'
  | 'multi_choice'
  | 'text'
  | 'matrix'
  | 'composite'

export interface Question {
  id: string
  type: QuestionType
  label: string
  description?: string
  required: boolean
  options?: Option[]
  rows?: MatrixRow[]
  columns?: MatrixColumn[]
  subQuestions?: Question[]
}

export interface Option {
  id: string
  label: string
  hasTextInput?: boolean
}

export interface MatrixRow {
  id: string
  label: string
  cells: { [columnId: string]: string }
}

export interface MatrixColumn {
  id: string
  label: string
  options: Option[]
}
