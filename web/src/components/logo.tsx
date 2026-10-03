import { cn } from "@/lib/utils"

// Quote Desk mark: a speech bubble (an agent asking) holding a dollar sign (the quote).
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <path
        d="M8 3h16a5 5 0 0 1 5 5v11a5 5 0 0 1-5 5h-8.5L9 29v-5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5z"
        className="fill-primary"
      />
      <g className="stroke-primary-foreground" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 6.5v14" />
        <path d="M19.6 9.6c-.6-1-1.9-1.6-3.6-1.6-2.1 0-3.6 1.1-3.6 2.6 0 3.6 7.2 1.7 7.2 5.2 0 1.6-1.5 2.7-3.6 2.7-1.8 0-3.1-.7-3.7-1.7" />
      </g>
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      Quote Desk
    </span>
  )
}
