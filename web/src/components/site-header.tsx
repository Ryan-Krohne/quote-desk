"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { useSession } from "@/hooks/use-session"
import { supabase } from "@/lib/supabase"

export function SiteHeader() {
  const { session } = useSession()

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="font-semibold tracking-tight">
          Quote Desk
        </Link>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground">
            Owner dashboard
          </Link>
          <Link href="/board" className="hover:text-foreground">
            Quote board
          </Link>
        </nav>
        {session && (
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{session.user.email}</span>
            <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()}>
              Sign out
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
