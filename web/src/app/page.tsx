import { ArrowRightIcon, BotIcon, MicIcon, MonitorIcon } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const MCP_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/mcp`

const STEPS = [
  {
    icon: BotIcon,
    title: "The homeowner asks Claude",
    body: "Claude reads a photo of the water heater label, builds a job packet, and asks for any missing facts.",
  },
  {
    icon: MicIcon,
    title: "Each business's desk quotes",
    body: "The desk prices the job from the owner's own rules. If a fact is missing, it asks the owner, who answers by voice.",
  },
  {
    icon: MonitorIcon,
    title: "Claude ranks and books",
    body: "Claude compares the quotes, explains the ranking with each quote's reasons, and books one with a test deposit.",
  },
]

export default function Home() {
  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4 pt-8">
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Google&apos;s AI can call a plumber. The plumber still can&apos;t give a price.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Quote Desk gives every home service business an agent-ready desk. AI agents send the facts of a job and get back a
          firm quote with reasons, or a question the owner answers once.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/dashboard" />}>
            Owner dashboard <ArrowRightIcon />
          </Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/board" />}>
            Quote board
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardHeader>
              <Icon className="mb-2 size-6 text-primary" />
              <CardTitle>{title}</CardTitle>
              <CardDescription>{body}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="flex flex-col gap-2 rounded-xl border bg-muted/40 p-6">
        <h2 className="font-semibold">Connect Claude</h2>
        <p className="text-sm text-muted-foreground">
          In claude.ai, open Settings → Connectors → Add custom connector, and paste this URL:
        </p>
        <code className="w-fit rounded-md bg-background px-3 py-2 font-mono text-sm">{MCP_URL}</code>
      </section>
    </div>
  )
}
