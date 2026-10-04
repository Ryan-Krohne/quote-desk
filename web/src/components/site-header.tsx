"use client"

import Link from "next/link"

import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { useSession } from "@/hooks/use-session"
import { supabase } from "@/lib/supabase"

export function SiteHeader() {
  const { session } = useSession()

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/" aria-label="Quote Desk home">
          <Logo />
        </Link>
        <nav className="flex gap-4 overflow-x-auto text-sm whitespace-nowrap text-muted-foreground">
          <Link href="/businesses" className="hover:text-foreground">
            Businesses
          </Link>
          <Link href="/board" className="hover:text-foreground">
            Live quote board
          </Link>
          <Link href="/dashboard" className="hover:text-foreground">
            For business owners
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
