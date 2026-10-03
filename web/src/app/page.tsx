import {
  ArrowRightIcon,
  BotIcon,
  CameraIcon,
  CheckCircle2Icon,
  MessageCircleQuestionIcon,
  MicIcon,
  SparklesIcon,
  WrenchIcon,
} from "lucide-react"
import Link from "next/link"

import { CopyButton } from "@/components/copy-button"
import { LogoMark } from "@/components/logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SUPABASE_PROJECT_URL } from "@/lib/supabase"
import { cn } from "@/lib/utils"

const MCP_URL = `${SUPABASE_PROJECT_URL}/functions/v1/mcp`

// Entrance animation (tw-animate-css), staggered with delay-*.
const rise = "animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700"

const STATS = [
  { value: "~50%", label: "of businesses gave Google's AI caller no price at all" },
  { value: "0", label: "site visits needed before a firm quote" },
  { value: "5", label: "MCP tools any agent can call" },
]

const STEPS = [
  {
    icon: CameraIcon,
    title: "The homeowner asks Claude",
    body: "Claude reads a photo of the water heater label, builds a job packet, and asks only for the facts that are missing.",
  },
  {
    icon: MicIcon,
    title: "Each desk quotes, or asks once",
    body: "Every business's desk prices the job from the owner's own rules. If a fact is missing, the owner answers by voice and it becomes a rule.",
  },
  {
    icon: BotIcon,
    title: "Claude ranks and books",
    body: "Claude compares the quotes, explains the ranking with each quote's reasons, and books one with a test-mode deposit.",
  },
]

const TOOLS = [
  { name: "list_trades", body: "Supported trades and the facts each one needs" },
  { name: "submit_job", body: "Create a job packet; returns the missing facts" },
  { name: "request_quotes", body: "Send the job to every desk in the ZIP code" },
  { name: "get_quotes", body: "Prices, reasons, conditions and status for each quote" },
  { name: "book_quote", body: "Book a quote and get a Stripe deposit link" },
]

export default function Home() {
  return (
    <div className="flex flex-col gap-24 pb-16">
      <Hero />
      <Stats />
      <HowItWorks />
      <Tools />
      <Connect />
    </div>
  )
}

function Hero() {
  return (
    <section className="relative grid items-center gap-12 pt-8 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
      {/* Background glow and grid */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-32 -z-10 h-[640px]">
        <div className="absolute left-1/2 top-0 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-linear-to-r from-emerald-300/40 via-sky-300/40 to-violet-300/40 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[48px_48px] mask-[radial-gradient(ellipse_at_center,black_30%,transparent_75%)] opacity-60" />
      </div>

      <div className="flex flex-col gap-6">
        <Badge variant="outline" className={cn(rise, "w-fit gap-1.5 bg-background/70 px-3 py-1 text-sm backdrop-blur")}>
          <SparklesIcon className="text-violet-500" /> Built for AI agents · Supabase Select 2026
        </Badge>
        <h1 className={cn(rise, "delay-100 text-5xl font-semibold tracking-tight text-balance sm:text-6xl")}>
          Google&apos;s AI can call a plumber.{" "}
          <span className="bg-linear-to-r from-emerald-600 via-sky-600 to-violet-600 bg-clip-text text-transparent">
            The plumber still can&apos;t give a price.
          </span>
        </h1>
        <p className={cn(rise, "delay-200 max-w-xl text-lg text-pretty text-muted-foreground")}>
          Quote Desk gives every home service business an agent-ready desk. Agents send the facts of a job and get back a
          firm quote with reasons, or a question the owner answers once.
        </p>
        <div className={cn(rise, "delay-300 flex flex-wrap gap-3")}>
          <Button size="lg" className="h-11 px-5 text-base" nativeButton={false} render={<Link href="/board" />}>
            See the live quote board <ArrowRightIcon />
          </Button>
          <Button size="lg" variant="outline" className="h-11 bg-background/70 px-5 text-base" nativeButton={false} render={<Link href="/dashboard" />}>
            I&apos;m a business owner
          </Button>
        </div>
      </div>

      <ChatMock />
    </section>
  )
}

// A static picture of the demo: what the homeowner sees in claude.ai.
// Prices follow the seeded rules for a 50-gallon gas tank with standard venting.
function ChatMock() {
  const quotes = [
    { name: "Blue Line Plumbing", range: "$1,940 – $2,390", note: "Haul-away $90", best: true },
    { name: "Old Town Water Heaters", range: "$1,950 – $2,400", note: "Owner answered by voice", asked: true },
    { name: "Northside Plumbing & Heating", range: "$2,150 – $2,750", note: "Permit $150" },
  ]

  return (
    <div className={cn(rise, "delay-300 duration-1000 relative")}>
      <div aria-hidden className="absolute -inset-4 -z-10 rounded-3xl bg-linear-to-br from-emerald-200/50 via-sky-200/40 to-violet-200/50 blur-2xl" />
      <div className="overflow-hidden rounded-2xl border bg-background/90 shadow-2xl shadow-sky-900/10 backdrop-blur">
        <div className="flex items-center gap-2 border-b px-4 py-3 text-sm">
          <div className="flex gap-1.5">
            <span className="size-3 rounded-full bg-red-400" />
            <span className="size-3 rounded-full bg-amber-400" />
            <span className="size-3 rounded-full bg-emerald-400" />
          </div>
          <span className="ml-2 font-medium">Claude</span>
          <Badge variant="secondary" className="ml-auto gap-1">
            <LogoMark className="size-3.5" /> Quote Desk connected
          </Badge>
        </div>

        <div className="flex flex-col gap-4 p-4 text-sm">
          <div className="ml-auto flex max-w-[85%] flex-col items-end gap-2">
            <div className="rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground">
              My water heater is leaking at the bottom. Here&apos;s the label.
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs text-muted-foreground">
              <CameraIcon className="size-3.5" /> water-heater-label.jpg
            </div>
          </div>

          <div className="flex max-w-[92%] flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              {["submit_job", "request_quotes", "get_quotes"].map((tool) => (
                <span key={tool} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                  <WrenchIcon className="size-3" /> {tool}
                </span>
              ))}
            </div>
            <p>
              From the label: <strong>50 gal gas, 12 years old</strong>, standard venting. Three local desks quoted:
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {quotes.map((q, i) => (
              <div
                key={q.name}
                className={cn(
                  "animate-in fade-in slide-in-from-right-4 fill-mode-both duration-500 flex items-center gap-3 rounded-xl border p-3",
                  i === 0 ? "delay-500" : i === 1 ? "delay-700" : "delay-1000",
                  q.best && "border-emerald-500/60 bg-emerald-50/60 dark:bg-emerald-950/30"
                )}
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{q.name}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {q.asked ? <MessageCircleQuestionIcon className="size-3.5" /> : <CheckCircle2Icon className="size-3.5" />}
                    {q.note}
                  </span>
                </div>
                <span className="ml-auto font-semibold tabular-nums">{q.range}</span>
                {q.best && <Badge className="bg-emerald-600 text-white">Best</Badge>}
              </div>
            ))}
          </div>

          <p className="text-muted-foreground">
            Blue Line is the best value: lowest total, and haul-away is included in the range. Want me to book it with a $50
            deposit?
          </p>
        </div>
      </div>
    </div>
  )
}

function Stats() {
  return (
    <section className="grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3">
      {STATS.map((s) => (
        <div key={s.label} className="flex flex-col gap-1 bg-background p-6">
          <span className="bg-linear-to-r from-emerald-600 to-sky-600 bg-clip-text text-4xl font-semibold tracking-tight text-transparent">
            {s.value}
          </span>
          <span className="text-sm text-muted-foreground">{s.label}</span>
        </div>
      ))}
    </section>
  )
}

function HowItWorks() {
  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-semibold tracking-tight">From a photo to a booked job</h2>
        <p className="text-muted-foreground">No phone tag, no site visit just to get a number.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <div key={title} className="group relative flex flex-col gap-3 rounded-2xl border p-6 transition hover:-translate-y-1 hover:shadow-lg">
            <span className="absolute right-5 top-4 text-5xl font-semibold text-muted/80 transition group-hover:text-muted-foreground/30">
              {i + 1}
            </span>
            <div className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-sky-500 text-white">
              <Icon className="size-5" />
            </div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Tools() {
  return (
    <section className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-semibold tracking-tight">An endpoint agents can act on</h2>
        <p className="text-muted-foreground">
          Every tool returns plain, typed fields, so an agent never has to parse prose. Each tool call runs as the signed-in
          homeowner, with Row Level Security on every row.
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-zinc-950 text-zinc-100">
        {TOOLS.map((t) => (
          <div key={t.name} className="flex flex-col gap-0.5 border-b border-zinc-800 px-5 py-3 last:border-0 sm:flex-row sm:items-center sm:gap-4">
            <code className="w-40 shrink-0 font-mono text-sm text-emerald-400">{t.name}</code>
            <span className="text-sm text-zinc-400">{t.body}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function Connect() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-zinc-950 p-8 text-white sm:p-12">
      <div aria-hidden className="absolute -right-24 -top-24 size-80 rounded-full bg-linear-to-br from-emerald-500/40 to-violet-500/40 blur-3xl" />
      <div className="relative flex flex-col gap-4">
        <h2 className="text-3xl font-semibold tracking-tight">Connect Claude in one step</h2>
        <p className="max-w-xl text-zinc-400">In claude.ai, open Settings → Connectors → Add custom connector, and paste this URL.</p>
        <div className="flex w-fit max-w-full items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-1.5 pl-4">
          <code className="truncate font-mono text-sm text-zinc-200">{MCP_URL}</code>
          <CopyButton value={MCP_URL} />
        </div>
      </div>
    </section>
  )
}
