"use client"

import { CheckCircle2Icon, Loader2Icon, XCircleIcon } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { invokeFunction } from "@/lib/functions"

type Result = { state: "loading" } | { state: "paid" } | { state: "error"; message: string }

export function BookingConfirmation() {
  const sessionId = useSearchParams().get("session_id")
  const [fetched, setFetched] = useState<Result>({ state: "loading" })
  const result: Result = sessionId ? fetched : { state: "error", message: "This page needs a Stripe session_id." }

  useEffect(() => {
    if (!sessionId) return
    invokeFunction<{ booking_id: string; status: string }>("confirm-booking", { session_id: sessionId }).then(({ data, error }) => {
      if (error || data?.status !== "paid") setFetched({ state: "error", message: error ?? "The deposit is not paid yet." })
      else setFetched({ state: "paid" })
    })
  }, [sessionId])

  return (
    <Card>
      <CardHeader className="items-center text-center">
        {result.state === "loading" && <Loader2Icon className="mx-auto size-10 animate-spin text-muted-foreground" />}
        {result.state === "paid" && <CheckCircle2Icon className="mx-auto size-10 text-green-600" />}
        {result.state === "error" && <XCircleIcon className="mx-auto size-10 text-destructive" />}
        <CardTitle className="text-2xl">
          {result.state === "loading" ? "Confirming your deposit…" : result.state === "paid" ? "You're booked" : "We couldn't confirm the deposit"}
        </CardTitle>
        <CardDescription>
          {result.state === "paid"
            ? "Your deposit is paid. The business will contact you to schedule the work. You can close this tab and go back to Claude."
            : result.state === "error"
              ? result.message
              : "This takes a few seconds."}
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
