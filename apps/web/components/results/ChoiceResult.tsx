import type { ChoiceResultsQuestion } from '@/lib/results'

type ChoiceResultProps = {
  question: ChoiceResultsQuestion
}

export function ChoiceResult({ question }: ChoiceResultProps) {
  const options = question.options ?? []
  const maxCount = Math.max(...options.map((option) => question.tally[option.id] ?? 0), 0)
  const totalSelections = options.reduce(
    (sum, option) => sum + (question.tally[option.id] ?? 0),
    0,
  )

  return (
    <div className="space-y-3">
      {options.map((option) => {
        const count = question.tally[option.id] ?? 0
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
