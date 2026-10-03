import { Badge } from "@/components/ui/badge"
import type { QuoteStatus } from "@/lib/types"

const LABELS: Record<QuoteStatus, string> = {
  pending: "Pricing…",
  waiting_for_owner: "Asking the owner",
  quoted: "Quoted",
  declined: "Declined",
}

const VARIANTS: Record<QuoteStatus, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  waiting_for_owner: "secondary",
  quoted: "default",
  declined: "destructive",
}

export function StatusBadge({ status }: { status: QuoteStatus }) {
  return <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>
}
