"use client"

import { Loader2Icon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { SignInForm } from "@/components/sign-in-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { VoiceInput } from "@/components/voice-input"
import { useSession } from "@/hooks/use-session"
import { formatDollars, labelFromKey } from "@/lib/format"
import { invokeFunction } from "@/lib/functions"
import { supabase } from "@/lib/supabase"
import type { Business, Job, OwnerQuestion, PricingRule } from "@/lib/types"

type QuestionWithJob = OwnerQuestion & { quotes: { jobs: Pick<Job, "description" | "facts" | "zip_code"> | null } | null }

async function fetchRules(businessId: string): Promise<PricingRule[]> {
  const { data } = await supabase
    .from("pricing_rules")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
  return data ?? []
}

async function fetchQuestions(businessId: string): Promise<QuestionWithJob[]> {
  const { data } = await supabase
    .from("owner_questions")
    .select("*, quotes (jobs (description, facts, zip_code))")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(20)
  return (data as QuestionWithJob[] | null) ?? []
}

export default function DashboardPage() {
  const { session, ready } = useSession()
  const userId = session?.user.id
  const [loaded, setLoaded] = useState<{ userId: string; business: Business | null } | null>(null)
  // undefined while loading for the current user
  const business = loaded && loaded.userId === userId ? loaded.business : undefined

  useEffect(() => {
    if (!userId) return
    // RLS lets every signed-in user read all businesses, so filter to the owner's own.
    supabase
      .from("businesses")
      .select("*")
      .eq("owner_user_id", userId)
      .maybeSingle()
      .then(({ data }) => setLoaded({ userId, business: data }))
  }, [userId])

  if (!ready) return <Loader2Icon className="mx-auto animate-spin text-muted-foreground" />

  if (!session) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Owner sign-in</CardTitle>
          <CardDescription>Sign in to set your prices and answer questions from your desk.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm />
        </CardContent>
      </Card>
    )
  }

  if (business === undefined) return <Loader2Icon className="mx-auto animate-spin text-muted-foreground" />

  if (business === null) {
    return (
      <Alert className="mx-auto max-w-xl">
        <AlertTitle>This account does not own a business</AlertTitle>
        <AlertDescription>Sign in with a business owner account to use the dashboard.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{business.name}</h1>
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <Badge variant="secondary">{labelFromKey(business.trade)}</Badge>
          <span>Serves {business.service_zip_codes.join(", ")}</span>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <QuestionsPanel businessId={business.id} />
        <RulesPanel businessId={business.id} />
      </div>
    </div>
  )
}

function RulesPanel({ businessId }: { businessId: string }) {
  const [rules, setRules] = useState<PricingRule[]>([])
  const [busy, setBusy] = useState(false)

  const load = () => fetchRules(businessId).then(setRules)

  useEffect(() => {
    const refresh = () => fetchRules(businessId).then(setRules)
    refresh()
    const channel = supabase
      .channel(`rules-${businessId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pricing_rules", filter: `business_id=eq.${businessId}` }, refresh)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [businessId])

  async function addRules(transcript: string) {
    setBusy(true)
    const { data, error } = await invokeFunction<{ rules: PricingRule[] }>("speech-to-rules", {
      business_id: businessId,
      transcript,
      source: "interview",
    })
    setBusy(false)
    if (error) {
      toast.error(error)
      return false
    }
    const count = data?.rules.length ?? 0
    toast.success(count === 0 ? "No prices found in that. Try again with a price." : `Added ${count} rule${count === 1 ? "" : "s"}.`)
    await load()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing rules</CardTitle>
        <CardDescription>Say your prices the way you would tell a customer. Your desk quotes from these.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <VoiceInput
          label="Add pricing rules"
          placeholder="For example: a 50 gallon gas tank swap is 1,800 to 2,200 dollars, add 300 if the venting needs work."
          submitLabel="Save rules"
          busy={busy}
          onSubmit={addRules}
        />
        <ul className="flex flex-col divide-y">
          {rules.map((rule) => (
            <li key={rule.id} className="flex flex-col gap-1 py-3">
              <p>{rule.rule_text}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                {rule.structured_rule && <Badge variant="outline">{labelFromKey(rule.structured_rule.kind)}</Badge>}
                {rule.structured_rule?.amount != null && <Badge variant="outline">{formatDollars(rule.structured_rule.amount)}</Badge>}
                {rule.source === "answer" && <Badge variant="secondary">From an answer</Badge>}
              </div>
            </li>
          ))}
          {rules.length === 0 && <li className="py-3 text-muted-foreground">No rules yet.</li>}
        </ul>
      </CardContent>
    </Card>
  )
}

function QuestionsPanel({ businessId }: { businessId: string }) {
  const [questions, setQuestions] = useState<QuestionWithJob[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = () => fetchQuestions(businessId).then(setQuestions)

  useEffect(() => {
    const refresh = () => fetchQuestions(businessId).then(setQuestions)
    refresh()
    const channel = supabase
      .channel(`questions-${businessId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "owner_questions", filter: `business_id=eq.${businessId}` }, (payload) => {
        if (payload.eventType === "INSERT") toast.info("Your desk has a new question.")
        refresh()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [businessId])

  async function answer(questionId: string, answerText: string) {
    setBusyId(questionId)
    const { error } = await invokeFunction("answer-question", { question_id: questionId, answer_text: answerText })
    setBusyId(null)
    if (error) {
      toast.error(error)
      return false
    }
    toast.success("Answer saved. Your desk is finishing the quote.")
    await load()
  }

  const open = questions.filter((q) => !q.answered_at)
  const answered = questions.filter((q) => q.answered_at)

  return (
    <Card className={open.length > 0 ? "ring-2 ring-primary" : undefined}>
      <CardHeader>
        <CardTitle>Questions from your desk</CardTitle>
        <CardDescription>When your desk is not sure how to price a job, it asks you here. Your answer becomes a rule.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {open.length === 0 && <p className="text-muted-foreground">No open questions. New ones appear here live.</p>}
        {open.map((q) => {
          const job = q.quotes?.jobs
          return (
            <div key={q.id} className="flex flex-col gap-4 rounded-lg border p-4">
              <p className="text-2xl font-semibold">{q.question}</p>
              {job && (
                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <p>{job.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(job.facts).map(([key, value]) => (
                      <Badge key={key} variant="outline">
                        {labelFromKey(key)}: {String(value)}
                      </Badge>
                    ))}
                    <Badge variant="outline">ZIP {job.zip_code}</Badge>
                  </div>
                </div>
              )}
              <VoiceInput
                label="Your answer"
                placeholder="For example: yes, standard venting. Add 300 dollars if it needs a new flue."
                submitLabel="Send answer"
                busy={busyId === q.id}
                onSubmit={(text) => answer(q.id, text)}
              />
            </div>
          )
        })}
        {answered.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">Answered</h3>
            <ul className="flex flex-col divide-y text-sm">
              {answered.map((q) => (
                <li key={q.id} className="py-2">
                  <p className="font-medium">{q.question}</p>
                  <p className="text-muted-foreground">{q.answer}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
