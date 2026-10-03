import type { McpServer } from 'npm:@modelcontextprotocol/server@2.0.0'
import { z } from 'npm:zod@4.6.5'

import { missingFacts, TRADE_NAMES, TRADES } from '../../_shared/trades.ts'
import { one } from '../../_shared/http.ts'
import { startQuoteEngine } from '../../_shared/quote-engine-client.ts'
import { errorResult, jsonResult, runtimeErrorResult } from './result.ts'
import type { ToolContext } from './types.ts'

// The Quote Desk agent interface (docs/contract.md, section 8). Every tool acts
// as the signed-in homeowner: jobs are read and written through RLS, and only
// quotes and bookings are written with the admin client.

const FINAL_STATUSES = new Set(['quoted', 'declined'])

const factValue = z.union([z.string(), z.number(), z.boolean(), z.null()])

export function registerQuoteDeskTools(server: McpServer, { supabase, supabaseAdmin, userClaims }: ToolContext): void {
  server.registerTool(
    'list_trades',
    {
      description: 'List the supported trades and the job facts each trade needs. Call this before submit_job.',
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    () => jsonResult({ trades: TRADES })
  )

  server.registerTool(
    'submit_job',
    {
      description:
        'Create a job packet from the facts you read in the homeowner\'s photos and description, or add facts to ' +
        'an existing job by passing its job_id. Returns missing_facts: ask the homeowner for each one, then call ' +
        'submit_job again with the job_id. Use only facts the homeowner gave or that you read from photos.',
      inputSchema: z.object({
        job_id: z.string().uuid().optional().describe('Pass to update an existing job. Omit to create one.'),
        trade: z.enum(TRADE_NAMES),
        description: z.string().min(1).max(2000).describe("The homeowner's problem, in your words."),
        facts: z.record(z.string(), factValue).describe('Fact names and values from list_trades.'),
        zip_code: z.string().regex(/^\d{5}$/),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ job_id, trade, description, facts, zip_code }) => {
      try {
        if (job_id) {
          const { data: job, error } = await supabase.from('jobs').select('id, facts').eq('id', job_id).maybeSingle()
          if (error) throw error
          if (!job) return errorResult('Job not found. Omit job_id to create a new job.')
          const merged = { ...(job.facts as Record<string, unknown>), ...facts }
          const { error: updateError } = await supabase
            .from('jobs')
            .update({ trade, description, facts: merged, zip_code })
            .eq('id', job_id)
          if (updateError) throw updateError
          return jsonResult({ job_id, missing_facts: missingFacts(trade, merged) })
        }

        const { data: job, error } = await supabase
          .from('jobs')
          .insert({ homeowner_user_id: userClaims.id, trade, description, facts, zip_code })
          .select('id')
          .single()
        if (error) throw error
        return jsonResult({ job_id: job.id, missing_facts: missingFacts(trade, facts) })
      } catch (error) {
        return runtimeErrorResult(error)
      }
    }
  )

  server.registerTool(
    'request_quotes',
    {
      description:
        'Send a job to every business that does this trade in the job\'s ZIP code. Fails if required facts are ' +
        'missing. Returns at once; call get_quotes to follow the quotes.',
      inputSchema: z.object({ job_id: z.string().uuid() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ job_id }) => {
      try {
        const { data: job, error } = await supabase
          .from('jobs')
          .select('id, trade, facts, zip_code')
          .eq('id', job_id)
          .maybeSingle()
        if (error) throw error
        if (!job) return errorResult('Job not found.')

        const missing = missingFacts(job.trade, job.facts as Record<string, unknown>)
        if (missing.length > 0) {
          return errorResult(`Missing required facts: ${missing.join(', ')}. Ask the homeowner, then call submit_job.`)
        }

        const { data: businesses, error: businessError } = await supabase
          .from('businesses')
          .select('id')
          .eq('trade', job.trade)
          .contains('service_zip_codes', [job.zip_code])
        if (businessError) throw businessError
        if (businesses.length === 0) return jsonResult({ quotes: [] })

        // Repeated calls keep existing quotes
        const { error: upsertError } = await supabaseAdmin
          .from('quotes')
          .upsert(
            businesses.map((b) => ({ job_id, business_id: b.id })),
            { onConflict: 'job_id,business_id', ignoreDuplicates: true }
          )
        if (upsertError) throw upsertError

        const { data: quotes, error: quotesError } = await supabaseAdmin
          .from('quotes')
          .select('id, status, businesses (name)')
          .eq('job_id', job_id)
          .order('created_at')
        if (quotesError) throw quotesError

        startQuoteEngine(quotes.filter((q) => q.status === 'pending').map((q) => q.id))

        return jsonResult({
          quotes: quotes.map((q) => ({
            quote_id: q.id,
            business_name: one(q.businesses)?.name ?? null,
            status: q.status,
          })),
        })
      } catch (error) {
        return runtimeErrorResult(error)
      }
    }
  )

  server.registerTool(
    'get_quotes',
    {
      description:
        'Get every quote for a job: price range, conditions, reasons and status. all_final is true when every ' +
        'quote is quoted or declined. Until then, wait a few seconds and call again.',
      inputSchema: z.object({ job_id: z.string().uuid() }),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ job_id }) => {
      try {
        const { data: job, error: jobError } = await supabase.from('jobs').select('id').eq('id', job_id).maybeSingle()
        if (jobError) throw jobError
        if (!job) return errorResult('Job not found.')

        const { data: quotes, error } = await supabase
          .from('quotes')
          .select(
            'id, status, low_price, high_price, conditions, reasons, confidence, decline_reason, ' +
              'businesses (name), owner_questions (question, answered_at, created_at)'
          )
          .eq('job_id', job_id)
          .order('created_at')
        if (error) throw error

        // deno-lint-ignore no-explicit-any
        const rows = quotes as any[]
        return jsonResult({
          job_id,
          all_final: rows.length > 0 && rows.every((q) => FINAL_STATUSES.has(q.status)),
          quotes: rows.map((q) => ({
            quote_id: q.id,
            business_name: q.businesses?.name ?? null,
            status: q.status,
            low_price: q.low_price,
            high_price: q.high_price,
            conditions: q.conditions,
            reasons: q.reasons,
            confidence: q.confidence,
            open_question:
              (q.owner_questions as { question: string; answered_at: string | null }[]).find(
                (oq) => oq.answered_at === null
              )?.question ?? null,
            decline_reason: q.decline_reason,
          })),
        })
      } catch (error) {
        return runtimeErrorResult(error)
      }
    }
  )

  server.registerTool(
    'book_quote',
    {
      description:
        'Book a quote the homeowner chose. The quote must have status "quoted". Returns a Stripe test-mode ' +
        'payment_url for the deposit; give it to the homeowner.',
      inputSchema: z.object({ quote_id: z.string().uuid() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ quote_id }) => {
      try {
        const paymentLink = Deno.env.get('STRIPE_PAYMENT_LINK_URL')
        if (!paymentLink) return errorResult('Booking is not set up yet: STRIPE_PAYMENT_LINK_URL is missing.')

        // RLS: the homeowner can read only quotes for their own jobs
        const { data: quote, error } = await supabase.from('quotes').select('id, status').eq('id', quote_id).maybeSingle()
        if (error) throw error
        if (!quote) return errorResult('Quote not found.')
        if (quote.status !== 'quoted') return errorResult(`This quote cannot be booked yet. Its status is ${quote.status}.`)

        const { data: existing, error: existingError } = await supabaseAdmin
          .from('bookings')
          .select('id, status')
          .eq('quote_id', quote_id)
          .maybeSingle()
        if (existingError) throw existingError

        let booking = existing
        if (!booking) {
          const { data, error: insertError } = await supabaseAdmin
            .from('bookings')
            .insert({ quote_id, homeowner_user_id: userClaims.id })
            .select('id, status')
            .single()
          if (insertError) throw insertError
          booking = data
        }

        const url = new URL(paymentLink)
        url.searchParams.set('client_reference_id', quote_id)
        return jsonResult({
          booking_id: booking.id,
          status: booking.status,
          payment_url: booking.status === 'paid' ? null : url.toString(),
        })
      } catch (error) {
        return runtimeErrorResult(error)
      }
    }
  )
}
