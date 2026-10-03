"use client"

import type { OAuthAuthorizationDetails } from "@supabase/supabase-js"
import { Loader2Icon } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { SignInForm } from "@/components/sign-in-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useSession } from "@/hooks/use-session"
import { supabase } from "@/lib/supabase"

export function ConsentCard() {
  const authorizationId = useSearchParams().get("authorization_id")
  const { session, ready } = useSession()
  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!authorizationId || !session) return
    supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error }) => {
      if (error || !data) return setError(error?.message ?? "This authorization request is not valid.")
      // No authorization_id means the user already approved this client: go straight back.
      if (!("authorization_id" in data)) {
        window.location.href = data.redirect_url
        return
      }
      setDetails(data)
    })
  }, [authorizationId, session])

  async function decide(approve: boolean) {
    if (!authorizationId) return
    setBusy(true)
    const { data, error } = approve
      ? await supabase.auth.oauth.approveAuthorization(authorizationId)
      : await supabase.auth.oauth.denyAuthorization(authorizationId)
    if (error || !data) {
      setError(error?.message ?? "Something went wrong. Start the connection again from Claude.")
      setBusy(false)
      return
    }
    window.location.href = data.redirect_url
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Connect to Quote Desk</CardTitle>
        <CardDescription>
          {session ? "Your assistant wants to request quotes for you." : "Sign in to let your assistant request quotes for you."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!authorizationId ? (
          <p className="text-muted-foreground">This page opens when an AI assistant connects to Quote Desk.</p>
        ) : !ready ? (
          <Loader2Icon className="animate-spin text-muted-foreground" />
        ) : !session ? (
          <SignInForm submitLabel="Sign in and continue" />
        ) : details ? (
          <div className="flex flex-col gap-2">
            <p>
              <strong>{details.client.name}</strong> wants to act for <strong>{session.user.email}</strong>: submit jobs,
              request quotes and book them.
            </p>
            {details.scope?.trim() && (
              <p className="text-sm text-muted-foreground">Permissions: {details.scope.split(" ").join(", ")}</p>
            )}
          </div>
        ) : (
          !error && <Loader2Icon className="animate-spin text-muted-foreground" />
        )}
      </CardContent>
      {details && (
        <CardFooter className="justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => decide(false)}>
            Deny
          </Button>
          <Button disabled={busy} onClick={() => decide(true)}>
            {busy && <Loader2Icon className="animate-spin" />}
            Approve
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
