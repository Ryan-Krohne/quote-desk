"use client"

import type { Session } from "@supabase/supabase-js"
import { useEffect, useState } from "react"

import { supabase } from "@/lib/supabase"

// The current Supabase session. `ready` is false until the stored session has been read,
// so pages can avoid flashing the sign-in form on reload.
export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return { session, ready }
}
