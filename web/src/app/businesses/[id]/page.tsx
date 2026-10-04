"use client"

import { ArrowLeftIcon, CalendarIcon, MapPinIcon, MicIcon } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDollars, labelFromKey } from "@/lib/format"
import { supabase } from "@/lib/supabase"
import type { Business, PricingRule } from "@/lib/types"

type Detail = Business & { pricing_rules: PricingRule[] }

// Public business page: profile and the rules its desk prices from.
export default function BusinessPage() {
  const { id } = useParams<{ id: string }>()
  const [business, setBusiness] = useState<Detail | null | undefined>(undefined)

  useEffect(() => {
    supabase
      .from("businesses")
      .select("*, pricing_rules(*)")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setBusiness((data as Detail | null) ?? null))
  }, [id])

  const back = (
    <Button variant="ghost" size="sm" className="w-fit" nativeButton={false} render={<Link href="/businesses" />}>
      <ArrowLeftIcon /> All businesses
    </Button>
  )

  if (business === undefined) return <Skeleton className="h-96" />
  if (business === null) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <p className="text-lg text-muted-foreground">This business was not found.</p>
      </div>
    )
  }

  const rules = [...business.pricing_rules].sort((a, b) => a.created_at.localeCompare(b.created_at))

  return (
    <div className="flex flex-col gap-8">
      {back}
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">{business.name}</h1>
        {business.tagline && <p className="text-xl text-muted-foreground">{business.tagline}</p>}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <Badge variant="secondary">{labelFromKey(business.trade)}</Badge>
          <span className="flex items-center gap-1">
            <MapPinIcon className="size-4" /> {business.city ?? "San Francisco"} · ZIP {business.service_zip_codes.join(", ")}
          </span>
          {business.founded_year && (
            <span className="flex items-center gap-1">
              <CalendarIcon className="size-4" /> Since {business.founded_year}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-muted-foreground">{business.description ?? "No description yet."}</p>
            {business.services.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {business.services.map((s) => (
                  <Badge key={s} variant="outline">
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How this desk prices a job</CardTitle>
            <CardDescription>
              The owner&apos;s own rules, in their words. The desk quotes only from these, and asks the owner when a rule
              is missing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {rules.map((rule) => (
                <li key={rule.id} className="flex flex-col gap-1 py-3">
                  <p>{rule.rule_text}</p>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {rule.structured_rule && <Badge variant="outline">{labelFromKey(rule.structured_rule.kind)}</Badge>}
                    {rule.structured_rule?.amount != null && (
                      <Badge variant="outline">{formatDollars(rule.structured_rule.amount)}</Badge>
                    )}
                    {rule.source === "answer" && (
                      <Badge variant="secondary" className="gap-1">
                        <MicIcon className="size-3" /> Learned from an owner answer
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
              {rules.length === 0 && <li className="py-3 text-muted-foreground">No rules yet.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
