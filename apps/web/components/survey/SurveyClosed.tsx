type SurveyClosedProps = {
  title: string
}

export function SurveyClosed({ title }: SurveyClosedProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--page-gradient)] px-6 py-16">
      <div className="w-full max-w-xl animate-[fadein_.3s_ease-out]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
          Survey closed
        </p>
        <h1 className="font-display mt-4 text-3xl leading-[1.1] tracking-[-0.02em] text-slate-950 sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 text-base leading-[1.7] text-slate-700">
          This survey is no longer accepting responses.
        </p>
      </div>
    </main>
  )
}
