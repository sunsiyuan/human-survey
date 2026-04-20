import type { ReactNode } from 'react'

export function Section({
  tag,
  children,
}: {
  tag: string
  children: ReactNode
}) {
  return (
    <section className="space-y-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
        {tag}
      </p>
      <div className="space-y-4 text-base leading-[1.8] text-slate-800">
        {children}
      </div>
    </section>
  )
}

export function Quote({ children }: { children: ReactNode }) {
  return (
    <blockquote className="rounded-2xl border-l-4 border-[var(--accent)] bg-[var(--surface)] px-5 py-4 font-display text-lg leading-8 text-slate-900">
      {children}
    </blockquote>
  )
}

export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl border border-[var(--panel-border)] bg-[var(--code-surface)] px-4 py-4 font-mono text-[12px] leading-5 text-[var(--accent-fg)]">
      {children}
    </pre>
  )
}

export function Ordered({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-[2px] shrink-0 font-mono text-[11px] text-[var(--accent)]">
            0{i + 1}
          </span>
          <span className="text-slate-800">{item}</span>
        </li>
      ))}
    </ol>
  )
}

export function Unordered({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
          <span className="text-slate-800">{item}</span>
        </li>
      ))}
    </ul>
  )
}
