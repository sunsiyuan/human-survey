'use client'

import { useEffect, useRef } from 'react'

import type { Question } from '@/lib/survey'

type AnswerValue = string | string[] | number | undefined

type QuestionStepProps = {
  question: Question
  index: number
  total: number
  value: AnswerValue
  optionTexts: Record<string, string>
  isLast: boolean
  submitting: boolean
  error: string | null
  onChange: (value: string | string[] | number) => void
  onOptionTextChange: (optionId: string, value: string) => void
  onNext: () => void
  onPrev: () => void
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function QuestionStep(props: QuestionStepProps) {
  const {
    question,
    index,
    total,
    value,
    optionTexts,
    isLast,
    submitting,
    error,
    onChange,
    onOptionTextChange,
    onNext,
    onPrev,
  } = props

  const firstInputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (question.type === 'text') {
      const t = setTimeout(() => firstInputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [question.id, question.type])

  useEffect(() => {
    if (question.type !== 'single_choice' && question.type !== 'multi_choice') return
    const options = question.options ?? []

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const letter = e.key.toUpperCase()
      const idx = LETTERS.indexOf(letter)
      if (idx < 0 || idx >= options.length) return

      e.preventDefault()
      const option = options[idx]
      const textValue = optionTexts[option.id] ?? ''

      if (question.type === 'single_choice') {
        onChange(encodeChoiceValue(option.id, textValue))
      } else {
        const current = Array.isArray(value) ? value : []
        const isSelected = current.some(
          (entry) => decodeChoiceValue(entry).optionId === option.id,
        )
        const filtered = current.filter(
          (entry) => decodeChoiceValue(entry).optionId !== option.id,
        )
        onChange(
          isSelected
            ? filtered
            : [...filtered, encodeChoiceValue(option.id, textValue)],
        )
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [question, value, optionTexts, onChange])

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-12 sm:py-20">
        <div key={question.id} className="animate-[fadein_.28s_ease-out]">
          <div className="flex items-baseline gap-2 font-mono text-sm text-[var(--accent)]">
            <span>{index + 1}</span>
            <span aria-hidden>→</span>
          </div>
          <h1 className="font-display mt-3 text-[26px] leading-[1.2] tracking-[-0.015em] text-slate-950 sm:text-[34px] sm:leading-[1.18]">
            {question.label}
            {question.required ? (
              <span className="ml-1 align-super text-base text-[var(--accent)]">*</span>
            ) : null}
          </h1>
          {question.description ? (
            <p className="mt-3 text-base leading-[1.7] text-slate-700">
              {question.description}
            </p>
          ) : null}

          <div className="mt-8">
            <QuestionBody
              question={question}
              value={value}
              optionTexts={optionTexts}
              firstInputRef={firstInputRef}
              onChange={onChange}
              onOptionTextChange={onOptionTextChange}
            />
          </div>

          {error ? (
            <p className="mt-6 text-sm font-medium text-rose-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </main>

      <footer className="sticky bottom-0 z-10 border-t border-[var(--panel-border)] bg-[var(--surface)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-6 py-4">
          <button
            type="button"
            onClick={onPrev}
            disabled={submitting}
            className="inline-flex min-h-9 items-center gap-1 text-sm text-slate-600 transition hover:text-slate-950 disabled:opacity-50"
          >
            <span aria-hidden>←</span> Back
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500 sm:inline">
              press Enter ↵
            </span>
            <button
              type="button"
              onClick={onNext}
              disabled={submitting}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--accent-strong)] px-5 text-sm font-semibold text-white shadow-[0_10px_30px_-15px_rgba(24,33,43,0.6)] transition hover:bg-slate-950 focus:outline-none focus:ring-4 focus:ring-[var(--accent-soft)] disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : isLast ? 'Submit' : 'OK'}
              <span aria-hidden>→</span>
            </button>
          </div>
        </div>
        <div className="mx-auto w-full max-w-2xl px-6 pb-3 text-[10px] uppercase tracking-[0.14em] text-slate-500">
          {index + 1} / {total}
        </div>
      </footer>
    </div>
  )
}

type QuestionBodyProps = {
  question: Question
  value: AnswerValue
  optionTexts: Record<string, string>
  firstInputRef: React.RefObject<HTMLTextAreaElement | null>
  onChange: (value: string | string[] | number) => void
  onOptionTextChange: (optionId: string, value: string) => void
}

function QuestionBody({
  question,
  value,
  optionTexts,
  firstInputRef,
  onChange,
  onOptionTextChange,
}: QuestionBodyProps) {
  if (question.type === 'text') {
    return (
      <textarea
        ref={firstInputRef}
        className="min-h-[7rem] w-full resize-none border-0 border-b border-[var(--panel-border)] bg-transparent pb-3 text-lg leading-[1.6] text-slate-950 outline-none transition focus:border-[var(--accent-strong)]"
        placeholder="Type your answer here…"
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  if (question.type === 'scale') {
    const min = question.min ?? 0
    const max = question.max ?? 0
    const points = Array.from({ length: max - min + 1 }, (_, offset) => min + offset)
    const selectedValue = typeof value === 'number' ? value : undefined

    return (
      <div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {points.map((point) => {
            const selected = selectedValue === point
            return (
              <button
                key={point}
                type="button"
                onClick={() => onChange(point)}
                className={`flex h-12 w-12 items-center justify-center rounded-xl border text-base font-medium transition ${
                  selected
                    ? 'border-[var(--accent-strong)] bg-[var(--accent-strong)] text-white'
                    : 'border-[var(--panel-border)] bg-[var(--surface)] text-slate-800 hover:border-[var(--accent)] hover:text-slate-950'
                }`}
              >
                {point}
              </button>
            )
          })}
        </div>
        {(question.minLabel || question.maxLabel) ? (
          <div className="mt-3 flex items-start justify-between gap-4 text-xs text-slate-500">
            <span>{question.minLabel ?? ''}</span>
            <span className="text-right">{question.maxLabel ?? ''}</span>
          </div>
        ) : null}
      </div>
    )
  }

  if (question.type === 'matrix') {
    const matrixOptions = question.columns?.[0]?.options ?? []
    const matrixSelections = parseMatrixSelections(
      Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : [],
    )

    return (
      <div className="overflow-x-auto rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)]">
        <table className="min-w-full border-collapse text-left text-sm text-slate-800">
          <thead>
            <tr className="border-b border-[var(--panel-border)]">
              <th className="px-4 py-3 font-semibold text-slate-950">Item</th>
              {matrixOptions.map((option) => (
                <th
                  key={option.id}
                  className="px-4 py-3 text-center font-semibold text-slate-950"
                >
                  {option.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(question.rows ?? []).map((row) => (
              <tr
                key={row.id}
                className="border-b border-[var(--panel-border)] last:border-b-0"
              >
                <td className="px-4 py-4 align-top">
                  <p className="font-medium text-slate-950">{row.label}</p>
                </td>
                {matrixOptions.map((option) => {
                  const checked = matrixSelections[row.id] === option.id
                  return (
                    <td key={option.id} className="px-4 py-4 text-center">
                      <label className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--panel-border)] bg-white transition hover:border-[var(--accent)]">
                        <input
                          type="radio"
                          className="h-4 w-4 accent-[var(--accent-strong)]"
                          name={`${question.id}-${row.id}`}
                          checked={checked}
                          onChange={() =>
                            onChange(
                              buildMatrixSelections(
                                Array.isArray(value) ? value : [],
                                row.id,
                                option.id,
                              ),
                            )
                          }
                        />
                      </label>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const isMultiChoice = question.type === 'multi_choice'
  const selectedValues = Array.isArray(value)
    ? value
    : typeof value === 'string' && value
      ? [value]
      : []

  return (
    <div className="space-y-3">
      {(question.options ?? []).map((option, optionIndex) => {
        const selectedEntry = selectedValues.find(
          (entry) => decodeChoiceValue(entry).optionId === option.id,
        )
        const selected = selectedEntry !== undefined
        const letter = LETTERS[optionIndex] ?? ''
        const textValue = optionTexts[option.id] ?? decodeChoiceValue(selectedEntry).text

        return (
          <label
            key={option.id}
            className={`block cursor-pointer rounded-xl border px-4 py-3 transition ${
              selected
                ? 'border-[var(--accent-strong)] bg-[var(--accent-soft)]'
                : 'border-[var(--panel-border)] bg-[var(--surface)] hover:border-[var(--accent)]'
            }`}
          >
            <div className="flex min-h-11 items-center gap-4">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border font-mono text-xs font-semibold transition ${
                  selected
                    ? 'border-[var(--accent-strong)] bg-[var(--accent-strong)] text-white'
                    : 'border-[var(--panel-border)] bg-white text-slate-700'
                }`}
                aria-hidden
              >
                {letter}
              </span>
              <input
                type={isMultiChoice ? 'checkbox' : 'radio'}
                name={question.id}
                className="sr-only"
                checked={selected}
                onChange={() =>
                  onChange(
                    updateChoiceValue({
                      value,
                      optionId: option.id,
                      isMultiChoice,
                      checked: !selected,
                      textValue,
                    }),
                  )
                }
              />
              <span className="flex-1 text-base leading-7 text-slate-900">
                {option.label}
              </span>
            </div>
            {option.hasTextInput && selected ? (
              <input
                className="mt-3 min-h-10 w-full rounded-lg border border-[var(--panel-border)] bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[var(--accent-strong)]"
                placeholder="Please specify"
                value={textValue}
                onChange={(event) => {
                  const nextValue = event.target.value
                  onOptionTextChange(option.id, nextValue)
                  onChange(
                    updateChoiceValue({
                      value,
                      optionId: option.id,
                      isMultiChoice,
                      checked: true,
                      textValue: nextValue,
                    }),
                  )
                }}
              />
            ) : null}
          </label>
        )
      })}
      {isMultiChoice ? (
        <p className="pl-1 font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500">
          Select all that apply · press a letter to toggle
        </p>
      ) : (
        <p className="pl-1 font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500">
          Press a letter to select
        </p>
      )}
    </div>
  )
}

function updateChoiceValue({
  value,
  optionId,
  isMultiChoice,
  checked,
  textValue,
}: {
  value: AnswerValue
  optionId: string
  isMultiChoice: boolean
  checked: boolean
  textValue: string
}) {
  const encoded = encodeChoiceValue(optionId, textValue)

  if (!isMultiChoice) {
    return checked ? encoded : ''
  }

  const current = Array.isArray(value) ? value : []
  const filtered = current.filter(
    (entry) => decodeChoiceValue(entry).optionId !== optionId,
  )

  return checked ? [...filtered, encoded] : filtered
}

function encodeChoiceValue(optionId: string, textValue: string) {
  return textValue ? `${optionId}::${textValue}` : optionId
}

function decodeChoiceValue(value?: string) {
  if (!value) {
    return { optionId: '', text: '' }
  }

  const [optionId, ...textParts] = value.split('::')

  return {
    optionId,
    text: textParts.join('::'),
  }
}

function parseMatrixSelections(values: string[]) {
  return values.reduce<Record<string, string>>((accumulator, entry) => {
    const [rowId, optionId] = entry.split(':')
    if (rowId && optionId) {
      accumulator[rowId] = optionId
    }
    return accumulator
  }, {})
}

function buildMatrixSelections(values: string[], rowId: string, optionId: string) {
  const nextSelections = values.filter((entry) => !entry.startsWith(`${rowId}:`))
  nextSelections.push(`${rowId}:${optionId}`)
  return nextSelections
}
