import type { Question } from '@mts/parser'

type ResponseRecord = {
  answers: Record<string, string | string[]>
}

type MatrixResultProps = {
  question: Question
  responses: ResponseRecord[]
}

export function MatrixResult({ question, responses }: MatrixResultProps) {
  const options = question.columns?.[0]?.options ?? []
  const rows = question.rows ?? []
  const counts = rows.reduce<Record<string, Record<string, number>>>((accumulator, row) => {
    accumulator[row.id] = options.reduce<Record<string, number>>((optionCounts, option) => {
      optionCounts[option.id] = 0
      return optionCounts
    }, {})
    return accumulator
  }, {})

  responses.forEach((response) => {
    const answer = response.answers[question.id]
    const selections = Array.isArray(answer) ? answer : []

    selections.forEach((entry) => {
      const [rowId, optionId] = entry.split(':')
      if (!rowId || !optionId || !counts[rowId] || typeof counts[rowId][optionId] !== 'number') {
        return
      }

      counts[rowId][optionId] += 1
    })
  })

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full border-collapse text-left text-sm text-slate-700">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 font-semibold text-slate-900">Item</th>
            {options.map((option) => (
              <th key={option.id} className="px-4 py-3 text-center font-semibold text-slate-900">
                {option.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rowCounts = counts[row.id]
            const rowMax = Math.max(...Object.values(rowCounts), 0)

            return (
              <tr key={row.id} className="border-t border-slate-200">
                <td className="px-4 py-4 align-top">
                  <p className="font-medium text-slate-900">{row.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {question.columns?.[0] ? row.cells[question.columns[0].id] : ''}
                  </p>
                </td>
                {options.map((option) => {
                  const value = rowCounts[option.id] ?? 0
                  const isTop = value > 0 && value === rowMax

                  return (
                    <td
                      key={option.id}
                      className={`px-4 py-4 text-center font-medium ${
                        isTop ? 'bg-blue-50 text-blue-700' : 'text-slate-600'
                      }`}
                    >
                      {value}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
