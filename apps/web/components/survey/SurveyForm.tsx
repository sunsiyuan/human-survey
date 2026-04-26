'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { Question, Survey } from '@/lib/survey'

import { ProgressBar } from './ProgressBar'
import { QuestionStep } from './QuestionStep'
import { ThankYou } from './ThankYou'
import { WelcomeStep } from './WelcomeStep'

type SurveyFormProps = {
  surveyId: string
  survey: Survey
  embedded?: boolean
}

type AnswerValue = string | string[] | number | undefined
type AnswerMap = Record<string, string | string[] | number>
type OptionTextMap = Record<string, Record<string, string>>
type Stage =
  | { kind: 'welcome' }
  | { kind: 'question'; id: string }
  | { kind: 'submitted' }

export function SurveyForm({ surveyId, survey, embedded = false }: SurveyFormProps) {
  const allQuestions = survey.sections.flatMap((section) => section.questions)

  const [answers, setAnswers] = useState<AnswerMap>({})
  const [optionTexts, setOptionTexts] = useState<OptionTextMap>({})
  const [stage, setStage] = useState<Stage>({ kind: 'welcome' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!embedded) return
    window.parent.postMessage(
      { source: 'humansurvey', type: 'loaded', surveyId },
      '*',
    )
  }, [embedded, surveyId])

  useEffect(() => {
    if (!embedded) return
    const node = rootRef.current
    if (!node) return
    const post = () => {
      const height = node.offsetHeight
      if (height === 0) return
      window.parent.postMessage(
        { source: 'humansurvey', type: 'resize', surveyId, height },
        '*',
      )
    }
    post()
    const observer = new ResizeObserver(post)
    observer.observe(node)
    return () => observer.disconnect()
  }, [embedded, surveyId])

  const visibleQuestions = allQuestions.filter((question) =>
    isVisible(question, allQuestions, answers),
  )
  const visibleQuestionIds = new Set(visibleQuestions.map((question) => question.id))
  const visibleIndex =
    stage.kind === 'question'
      ? visibleQuestions.findIndex((question) => question.id === stage.id)
      : -1
  const currentQuestion = visibleIndex >= 0 ? visibleQuestions[visibleIndex] : null

  useEffect(() => {
    const saved = window.localStorage.getItem(`mts_draft_${surveyId}`)
    if (!saved) return
    try {
      const parsed = JSON.parse(saved) as {
        answers?: AnswerMap
        optionTexts?: OptionTextMap
      }
      setAnswers(parsed.answers ?? {})
      setOptionTexts(parsed.optionTexts ?? {})
    } catch {
      window.localStorage.removeItem(`mts_draft_${surveyId}`)
    }
  }, [surveyId])

  useEffect(() => {
    window.localStorage.setItem(
      `mts_draft_${surveyId}`,
      JSON.stringify({ answers, optionTexts }),
    )
  }, [answers, optionTexts, surveyId])

  useEffect(() => {
    setAnswers((current) => pruneMap(current, visibleQuestionIds))
    setOptionTexts((current) => pruneMap(current, visibleQuestionIds))
  }, [visibleQuestions.map((question) => question.id).join(',')])

  useEffect(() => {
    if (stage.kind !== 'question') return
    if (visibleQuestionIds.has(stage.id)) return
    if (visibleQuestions.length === 0) {
      setStage({ kind: 'welcome' })
      return
    }
    setStage({ kind: 'question', id: visibleQuestions[0].id })
  }, [stage, visibleQuestionIds, visibleQuestions])

  const submit = useCallback(async () => {
    const unmet = visibleQuestions.find(
      (question) => question.required && !isAnswered(question, answers[question.id]),
    )
    if (unmet) {
      setError('Please answer this question before continuing.')
      setStage({ kind: 'question', id: unmet.id })
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(`/api/surveys/${surveyId}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      if (!response.ok) {
        throw new Error('Submission failed')
      }
      const { id: responseId } = (await response.json()) as { id: string }
      window.localStorage.removeItem(`mts_draft_${surveyId}`)
      if (embedded) {
        window.parent.postMessage(
          {
            source: 'humansurvey',
            type: 'submitted',
            surveyId,
            responseId,
            answers,
          },
          '*',
        )
      }
      setStage({ kind: 'submitted' })
    } catch {
      setError('Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [answers, embedded, surveyId, visibleQuestions])

  const start = useCallback(() => {
    if (visibleQuestions.length === 0) return
    setError(null)
    setStage({ kind: 'question', id: visibleQuestions[0].id })
  }, [visibleQuestions])

  const next = useCallback(() => {
    if (stage.kind !== 'question' || !currentQuestion) return
    if (
      currentQuestion.required &&
      !isAnswered(currentQuestion, answers[currentQuestion.id])
    ) {
      setError('Please answer this question before continuing.')
      return
    }
    setError(null)
    if (visibleIndex < visibleQuestions.length - 1) {
      setStage({ kind: 'question', id: visibleQuestions[visibleIndex + 1].id })
    } else {
      void submit()
    }
  }, [stage, currentQuestion, answers, visibleIndex, visibleQuestions, submit])

  const prev = useCallback(() => {
    if (stage.kind !== 'question') return
    setError(null)
    if (visibleIndex <= 0) {
      setStage({ kind: 'welcome' })
      return
    }
    setStage({ kind: 'question', id: visibleQuestions[visibleIndex - 1].id })
  }, [stage, visibleIndex, visibleQuestions])

  useEffect(() => {
    if (stage.kind !== 'question') return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Enter') return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'TEXTAREA' && !(e.metaKey || e.ctrlKey)) return
      e.preventDefault()
      next()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [stage, next])

  const totalRequired = visibleQuestions.filter((question) => question.required).length
  const answeredRequired = visibleQuestions.filter(
    (question) => question.required && isAnswered(question, answers[question.id]),
  ).length
  const progress =
    totalRequired === 0 ? 0 : Math.round((answeredRequired / totalRequired) * 100)

  const wrapperClass = embedded
    ? 'flex flex-col'
    : 'flex min-h-screen flex-col bg-[var(--page-gradient)]'

  return (
    <div ref={rootRef} className={wrapperClass}>
      {stage.kind === 'submitted' ? (
        <ThankYou embedded={embedded} />
      ) : (
        <>
          <ProgressBar percentage={progress} />
          {stage.kind === 'welcome' ? (
            <WelcomeStep
              survey={survey}
              questionCount={visibleQuestions.length}
              onStart={start}
            />
          ) : currentQuestion ? (
            <QuestionStep
              key={currentQuestion.id}
              question={currentQuestion}
              index={visibleIndex}
              total={visibleQuestions.length}
              value={answers[currentQuestion.id]}
              optionTexts={optionTexts[currentQuestion.id] ?? {}}
              isLast={visibleIndex === visibleQuestions.length - 1}
              submitting={submitting}
              error={error}
              onChange={(value) => {
                setError(null)
                setAnswers((current) => ({ ...current, [currentQuestion.id]: value }))
              }}
              onOptionTextChange={(optionId, value) =>
                setOptionTexts((current) => ({
                  ...current,
                  [currentQuestion.id]: {
                    ...(current[currentQuestion.id] ?? {}),
                    [optionId]: value,
                  },
                }))
              }
              onNext={next}
              onPrev={prev}
            />
          ) : null}
        </>
      )}
    </div>
  )
}

function isVisible(question: Question, questions: Question[], answers: AnswerMap) {
  if (!question.showIf) return true

  const sourceQuestion = questions.find(
    (candidate) => candidate.id === question.showIf?.questionId,
  )
  const sourceAnswer = answers[question.showIf.questionId]

  if (!sourceQuestion) return false
  if (!isAnswered(sourceQuestion, sourceAnswer)) return false

  const semanticAnswer = getSemanticAnswer(sourceQuestion, sourceAnswer)

  switch (question.showIf.operator) {
    case 'answered':
      return true
    case 'eq':
      return semanticEquals(semanticAnswer, question.showIf.value)
    case 'neq':
      return !semanticEquals(semanticAnswer, question.showIf.value)
    case 'contains':
      return (
        Array.isArray(semanticAnswer) &&
        semanticAnswer.includes(question.showIf.value ?? '')
      )
    default:
      return true
  }
}

function isAnswered(question: Question, value: AnswerValue) {
  if (question.type === 'text') {
    return typeof value === 'string' && value.trim().length > 0
  }
  if (question.type === 'scale') {
    return typeof value === 'number'
  }
  if (question.type === 'matrix') {
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      value.length === (question.rows?.length ?? 0)
    )
  }
  if (question.type === 'multi_choice') {
    return Array.isArray(value) && value.length > 0
  }
  return typeof value === 'string' && value.length > 0
}

function getSemanticAnswer(question: Question, value: AnswerValue) {
  if (question.type === 'single_choice') {
    if (typeof value !== 'string') return undefined
    return findOptionLabel(question, decodeChoiceValue(value))
  }
  if (question.type === 'multi_choice') {
    if (!Array.isArray(value)) return []
    return value
      .map((entry) => findOptionLabel(question, decodeChoiceValue(entry)))
      .filter((label): label is string => Boolean(label))
  }
  return value
}

function semanticEquals(
  value: string | string[] | number | undefined,
  expected?: string,
) {
  if (expected === undefined) return false
  if (Array.isArray(value)) return false
  return String(value) === expected
}

function findOptionLabel(question: Question, optionId: string) {
  return question.options?.find((option) => option.id === optionId)?.label
}

function decodeChoiceValue(value: string) {
  return value.split('::')[0] ?? ''
}

function pruneMap<T>(current: Record<string, T>, visibleQuestionIds: Set<string>) {
  const entries = Object.entries(current).filter(([questionId]) =>
    visibleQuestionIds.has(questionId),
  )
  if (entries.length === Object.keys(current).length) {
    return current
  }
  return Object.fromEntries(entries)
}
