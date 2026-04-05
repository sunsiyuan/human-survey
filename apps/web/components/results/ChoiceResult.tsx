import type { Question } from '@mts/parser'

type ResponseRecord = {
  answers: Record<string, string | string[]>
}

type ChoiceResultProps = {
  question: Question
  responses: ResponseRecord[]
}

export function ChoiceResult({ question, responses }: ChoiceResultProps) {
  const options = question.options ?? []
  const counts = new Map(options.map((option) => [option.id, 0]))

  responses.forEach((response) => {
    const answer = response.answers[question.id]
    const values = Array.isArray(answer) ? answer : typeof answer === 'string' ? [answer] : []

    values.forEach((entry) => {
      const optionId = decodeChoiceValue(entry)
      if (!optionId || !counts.has(optionId)) {
        return
      }

      counts.set(optionId, (counts.get(optionId) ?? 0) + 1)
    })
  })

  const maxCount = Math.max(...counts.values(), 0)
  const totalSelections = Array.from(counts.values()).reduce((sum, value) => sum + value, 0)

  return (
    <div className="space-y-3">
      {options.map((option) => {
        const count = counts.get(option.id) ?? 0
        const percentage =
          totalSelections === 0 ? 0 : Math.round((count / totalSelections) * 100)
        const width = maxCount === 0 ? 0 : Math.max((count / maxCount) * 100, count > 0 ? 8 : 0)

        return (
          <div key={option.id}>
            <div className="mb-2 flex items-center justify-between gap-4 text-sm">
              <span className="font-medium text-slate-900">{option.label}</span>
              <span className="text-slate-500">
                {count} • {percentage}%
              </span>
            </div>
            <div className="h-3 rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function decodeChoiceValue(value: string) {
  return value.split('::')[0] ?? ''
}
