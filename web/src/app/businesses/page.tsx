"use client"

import { ArrowRightIcon, MapPinIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { labelFromKey } from "@/lib/format"
import { supabase } from "@/lib/supabase"
import type { Business } from "@/lib/types"

type Listed = Business & { pricing_rules: { count: number }[] }

// Public directory: every business with a Quote Desk. No sign-in needed.
export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Listed[] | null>(null)

  useEffect(() => {
    supabase
      .from("businesses")
      .select("*, pricing_rules(count)")
      .order("name")
      .then(({ data }) => setBusinesses((data as Listed[] | null) ?? []))
  }, [])

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold tracking-tight">Businesses with a Quote Desk</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Each business has its own desk. When an AI agent sends a job, the desk prices it from the owner&apos;s rules,
          or asks the owner one question first. Demo businesses with made-up details.
        </p>
      </div>

      {businesses === null ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {businesses.map((b) => (
            <Link key={b.id} href={`/businesses/${b.id}`} className="group">
              <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">{b.name}</CardTitle>
                  {b.tagline && <CardDescription>{b.tagline}</CardDescription>}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                  {b.description && <p className="line-clamp-3 text-muted-foreground">{b.description}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{labelFromKey(b.trade)}</Badge>
                    <Badge variant="outline">{b.pricing_rules?.[0]?.count ?? 0} pricing rules</Badge>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-2 text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPinIcon className="size-3.5" /> {b.service_zip_codes.join(", ")}
                    </span>
                    <span className="flex items-center gap-1 font-medium text-foreground group-hover:underline">
                      Details <ArrowRightIcon className="size-3.5" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
