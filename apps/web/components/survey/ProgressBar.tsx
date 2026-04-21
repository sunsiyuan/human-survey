type ProgressBarProps = {
  percentage: number
}

export function ProgressBar({ percentage }: ProgressBarProps) {
  return (
    <div className="sticky top-0 z-20 h-1 w-full bg-[var(--panel-border)]">
      <div
        className="h-full bg-[var(--accent-strong)] transition-[width] duration-300 ease-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
