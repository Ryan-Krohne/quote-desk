"use client"

import { CheckCircle2Icon, Loader2Icon, MessageCircleQuestionIcon, RadioIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDollars, formatRange, labelFromKey } from "@/lib/format"
import { supabase } from "@/lib/supabase"
import type { QuoteReason, QuoteStatus } from "@/lib/types"

type BoardQuote = {
  id: string
  status: QuoteStatus
  low_price: number | null
  high_price: number | null
  conditions: string[]
  reasons: QuoteReason[]
  confidence: number | null
  decline_reason: string | null
  business_id: string
  business_name: string
  open_question: string | null
  answered: { question: string; answer: string }[]
  booking_status: "pending_payment" | "paid" | null
}

type Snapshot = {
  job: { id: string; trade: string; description: string; facts: Record<string, unknown>; zip_code: string } | null
  quotes: BoardQuote[]
}

const REFRESH_MS = 3000

// The stage screen. Public: it reads board_snapshot(), which returns the newest job
// and its quotes without any homeowner details. Refreshes every few seconds.
export default function BoardPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)

  useEffect(() => {
    let active = true
    const load = () =>
      supabase.rpc("board_snapshot").then(({ data }) => {
        if (active && data) setSnapshot(data as Snapshot)
      })
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  if (!snapshot) return <Skeleton className="h-64 w-full" />

  const { job, quotes } = snapshot
  if (!job) {
    return (
      <div className="flex flex-col items-center gap-2 py-24 text-center">
        <h1 className="text-3xl font-semibold">Waiting for a job…</h1>
        <p className="text-lg text-muted-foreground">Ask Claude for a water heater quote. The job appears here live.</p>
      </div>
    )
  }

  // Quoted first, cheapest first; then waiting; declined last.
  const sorted = [...quotes].sort((a, b) => {
    const rank = (q: BoardQuote) => (q.status === "quoted" ? 0 : q.status === "declined" ? 2 : 1)
    return rank(a) - rank(b) || (a.high_price ?? 0) - (b.high_price ?? 0)
  })

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <RadioIcon className="size-4 text-red-500 motion-safe:animate-pulse" /> Live quote board · updates every few
        seconds
      </div>
      <Card>
        <CardHeader>
          <CardDescription className="text-base">
            Latest job · {labelFromKey(job.trade)} · ZIP {job.zip_code}
          </CardDescription>
          <CardTitle className="text-3xl leading-tight">{job.description}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {Object.entries(job.facts).map(([key, value]) => (
            <Badge key={key} variant="secondary" className="text-sm">
              {labelFromKey(key)}: {String(value)}
            </Badge>
          ))}
        </CardContent>
      </Card>

      {quotes.length === 0 ? (
        <p className="text-lg text-muted-foreground">No quotes requested yet.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {sorted.map((quote, i) => (
            <QuoteCard key={quote.id} quote={quote} best={i === 0 && quote.status === "quoted"} />
          ))}
        </div>
      )}
    </div>
  )
}

function QuoteCard({ quote, best }: { quote: BoardQuote; best: boolean }) {
  const paid = quote.booking_status === "paid"

  return (
    <Card className={paid ? "ring-2 ring-green-600" : best ? "ring-2 ring-emerald-500/60" : undefined}>
      <CardHeader>
        <CardTitle className="text-xl">
          <Link href={`/businesses/${quote.business_id}`} className="hover:underline">
            {quote.business_name}
          </Link>
        </CardTitle>
        <CardAction className="flex gap-1.5">
          {best && <Badge className="bg-emerald-600 text-white">Best price</Badge>}
          <StatusBadge status={quote.status} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {quote.status === "quoted" && (
          <>
            <p className="text-4xl font-semibold tabular-nums">{formatRange(quote.low_price, quote.high_price)}</p>
            {quote.confidence != null && (
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Confidence</span>
                  <span>{Math.round(quote.confidence * 100)}%</span>
                </div>
                <Progress value={Math.round(quote.confidence * 100)} />
              </div>
            )}
            <ul className="flex flex-col gap-2 text-sm">
              {quote.reasons.map((r, i) => (
                <li key={i} className="flex flex-col">
                  <span className="flex justify-between gap-2 font-medium">
                    <span>{r.label}</span>
                    <span className="tabular-nums">{formatDollars(r.amount)}</span>
                  </span>
                  <span className="text-muted-foreground">{r.reason}</span>
                </li>
              ))}
            </ul>
            {quote.conditions.length > 0 && (
              <>
                <Separator />
                <ul className="list-inside list-disc text-sm text-muted-foreground">
                  {quote.conditions.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        {quote.status === "pending" && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2Icon className="animate-spin" /> Pricing from the owner&apos;s rules…
          </div>
        )}

        {quote.open_question && (
          <div className="flex gap-3 rounded-lg bg-secondary p-4">
            <MessageCircleQuestionIcon className="mt-1 shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">The desk asked its owner</p>
              <p className="text-lg font-semibold">{quote.open_question}</p>
            </div>
          </div>
        )}

        {quote.answered.map((q, i) => (
          <div key={i} className="text-sm">
            <p className="text-muted-foreground">Asked: {q.question}</p>
            <p>Owner: {q.answer}</p>
          </div>
        ))}

        {quote.status === "declined" && <p className="text-muted-foreground">{quote.decline_reason}</p>}

        {quote.booking_status && (
          <div className="flex items-center gap-2 font-medium">
            {paid ? (
              <>
                <CheckCircle2Icon className="text-green-600" /> Booked and deposit paid
              </>
            ) : (
              <>
                <Loader2Icon className="animate-spin" /> Booked, waiting for payment
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
