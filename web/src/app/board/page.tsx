"use client"

import { CheckCircle2Icon, Loader2Icon, MessageCircleQuestionIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { SignInForm } from "@/components/sign-in-form"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useSession } from "@/hooks/use-session"
import { formatDollars, formatRange, labelFromKey } from "@/lib/format"
import { supabase } from "@/lib/supabase"
import type { Booking, Job, OwnerQuestion, Quote } from "@/lib/types"

type BoardQuote = Quote & {
  businesses: { name: string } | null
  owner_questions: Pick<OwnerQuestion, "id" | "question" | "answer" | "answered_at">[]
  bookings: Pick<Booking, "status" | "paid_at">[]
}

async function fetchLatestJob(): Promise<Job | null> {
  const { data } = await supabase.from("jobs").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle()
  return data
}

async function fetchQuotes(jobId: string): Promise<BoardQuote[]> {
  const { data } = await supabase
    .from("quotes")
    .select("*, businesses (name), owner_questions (id, question, answer, answered_at), bookings (status, paid_at)")
    .eq("job_id", jobId)
    .order("created_at")
  return (data as BoardQuote[] | null) ?? []
}

// The stage screen. Shows the newest job and its quotes, live. Sign in as a board
// viewer (reads every job) or as the demo homeowner (reads their own jobs).
export default function BoardPage() {
  const { session, ready } = useSession()

  if (!ready) return <Loader2Icon className="mx-auto animate-spin text-muted-foreground" />
  if (!session) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Quote board</CardTitle>
          <CardDescription>Sign in with the board account to show live quotes.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm />
        </CardContent>
      </Card>
    )
  }
  return <LiveBoard />
}

function LiveBoard() {
  const [job, setJob] = useState<Job | null | undefined>(undefined)
  const jobId = job?.id
  const [loaded, setLoaded] = useState<{ jobId: string; quotes: BoardQuote[] } | null>(null)
  // Quotes from a previous job are not shown while the new job's quotes load.
  const quotes = loaded && loaded.jobId === jobId ? loaded.quotes : []

  useEffect(() => {
    const loadJob = () => fetchLatestJob().then(setJob)
    loadJob()
    const channel = supabase
      .channel("board-jobs")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, loadJob)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (!jobId) return
    const loadQuotes = () => fetchQuotes(jobId).then((quotes) => setLoaded({ jobId, quotes }))
    loadQuotes()
    // Any change to this job's quotes, questions or bookings reloads the quotes.
    const channel = supabase
      .channel(`board-${jobId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "quotes", filter: `job_id=eq.${jobId}` }, loadQuotes)
      .on("postgres_changes", { event: "*", schema: "public", table: "owner_questions" }, loadQuotes)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, loadQuotes)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [jobId])

  if (job === undefined) return <Skeleton className="h-64 w-full" />
  if (job === null) {
    return (
      <div className="flex flex-col items-center gap-2 py-24 text-center">
        <h1 className="text-3xl font-semibold">Waiting for a job…</h1>
        <p className="text-lg text-muted-foreground">Ask Claude for a water heater quote. The job appears here live.</p>
      </div>
    )
  }

  // Quoted first, cheapest first; the rest keep their order.
  const sorted = [...quotes].sort((a, b) => {
    const rank = (q: BoardQuote) => (q.status === "quoted" ? 0 : q.status === "declined" ? 2 : 1)
    return rank(a) - rank(b) || (a.low_price ?? 0) - (b.low_price ?? 0)
  })

  return (
    <div className="flex flex-col gap-8">
      <JobCard job={job} />
      {quotes.length === 0 ? (
        <p className="text-lg text-muted-foreground">No quotes requested yet.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {sorted.map((quote) => (
            <QuoteCard key={quote.id} quote={quote} />
          ))}
        </div>
      )}
    </div>
  )
}

function JobCard({ job }: { job: Job }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="text-base">New job · {labelFromKey(job.trade)} · ZIP {job.zip_code}</CardDescription>
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
  )
}

function QuoteCard({ quote }: { quote: BoardQuote }) {
  const openQuestion = quote.owner_questions.find((q) => !q.answered_at)
  const answered = quote.owner_questions.filter((q) => q.answered_at)
  const paid = quote.bookings.some((b) => b.status === "paid")
  const booked = quote.bookings.length > 0

  return (
    <Card className={paid ? "ring-2 ring-green-600" : undefined}>
      <CardHeader>
        <CardTitle className="text-xl">{quote.businesses?.name ?? "Business"}</CardTitle>
        <CardAction>
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

        {openQuestion && (
          <div className="flex gap-3 rounded-lg bg-secondary p-4">
            <MessageCircleQuestionIcon className="mt-1 shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">The desk asked its owner</p>
              <p className="text-lg font-semibold">{openQuestion.question}</p>
            </div>
          </div>
        )}

        {answered.map((q) => (
          <div key={q.id} className="text-sm">
            <p className="text-muted-foreground">Asked: {q.question}</p>
            <p>Owner: {q.answer}</p>
          </div>
        ))}

        {quote.status === "declined" && <p className="text-muted-foreground">{quote.decline_reason}</p>}

        {booked && (
          <div className="flex items-center gap-2 font-medium">
            {paid ? (
              <>
                <CheckCircle2Icon className="text-green-600" /> Deposit paid
              </>
            ) : (
              <>
                <Loader2Icon className="animate-spin" /> Booked, waiting for the deposit
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
