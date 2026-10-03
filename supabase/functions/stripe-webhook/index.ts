import 'jsr:@supabase/functions-js@2.108.2/edge-runtime.d.ts'

import { withSupabase } from 'npm:@supabase/server@1'

import { errorJson, json, one } from '../_shared/http.ts'

// Stripe webhook: marks a booking paid when its Checkout Session completes.
// The homeowner usually pays from the link we text them, on their phone, and may
// never reach /booking/success. This records the payment either way.
// confirm-booking does the same write, so whichever runs first wins and the other
// is a no-op.
//
// Events: checkout.session.completed, checkout.session.async_payment_succeeded.
// No Supabase auth: Stripe signs every request, and the signature is checked.
// Secrets: STRIPE_WEBHOOK_SECRET (whsec_..., from the Stripe webhook endpoint).

const TOLERANCE_SECONDS = 300
const HANDLED = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded'])

// Checks Stripe-Signature: t=<unix time>,v1=<hex HMAC-SHA256(secret, "t.payload")>.
async function isFromStripe(header: string | null, payload: string, secret: string): Promise<boolean> {
  if (!header) return false
  const parts = header.split(',').map((p) => p.split('='))
  const timestamp = parts.find(([k]) => k === 't')?.[1]
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v)
  if (!timestamp || signatures.length === 0) return false
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > TOLERANCE_SECONDS) return false

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)))
  const expected = [...mac].map((b) => b.toString(16).padStart(2, '0')).join('')
  return signatures.some((signature) => {
    if (signature.length !== expected.length) return false
    let diff = 0
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
    return diff === 0
  })
}

Deno.serve(
  withSupabase({ auth: 'none' }, async (request, { supabaseAdmin: db }) => {
    const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    if (!secret) return errorJson('Stripe webhook is not configured.', 500)

    const payload = await request.text()
    if (!(await isFromStripe(request.headers.get('Stripe-Signature'), payload, secret))) {
      return errorJson('Invalid signature.', 400)
    }

    const event = JSON.parse(payload)
    if (event.livemode) return errorJson('Only test-mode events are accepted.', 400)
    if (!HANDLED.has(event.type)) return json({ received: true, ignored: event.type })

    const session = event.data?.object
    if (session?.payment_status !== 'paid') return json({ received: true, paid: false })

    const quoteId = session.client_reference_id ?? session.metadata?.quote_id
    if (typeof quoteId !== 'string') {
      console.error('Paid session has no quote id', session.id)
      return json({ received: true, linked: false })
    }

    const { data: quote, error: quoteError } = await db
      .from('quotes')
      .select('id, jobs (homeowner_user_id)')
      .eq('id', quoteId)
      .maybeSingle()
    if (quoteError) return errorJson(quoteError.message, 500)
    const job = one(quote?.jobs)
    if (!quote || !job) {
      console.error('Paid session is linked to an unknown quote', session.id, quoteId)
      return json({ received: true, linked: false })
    }

    const { data: booking, error: bookingError } = await db
      .from('bookings')
      .upsert(
        {
          quote_id: quoteId,
          homeowner_user_id: job.homeowner_user_id,
          status: 'paid',
          stripe_session_id: session.id,
          paid_at: new Date((event.created ?? Date.now() / 1000) * 1000).toISOString(),
        },
        { onConflict: 'quote_id' }
      )
      .select('id, status')
      .single()
    // A 500 makes Stripe retry the event later.
    if (bookingError) return errorJson(bookingError.message, 500)
    return json({ received: true, booking_id: booking.id, status: booking.status })
  })
)
