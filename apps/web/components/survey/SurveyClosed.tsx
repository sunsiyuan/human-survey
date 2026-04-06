type SurveyClosedProps = {
  title: string
}

export function SurveyClosed({ title }: SurveyClosedProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.25)]">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
          Survey closed
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-5 text-base leading-7 text-slate-600">
          This survey is no longer accepting responses.
        </p>
      </div>
    </main>
  )
}
