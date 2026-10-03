import 'jsr:@supabase/functions-js@2.108.2/edge-runtime.d.ts'

import { withSupabase } from 'npm:@supabase/server@1'

import { errorJson, json, one, readJson } from '../_shared/http.ts'

// /booking/success page: confirms a Stripe test-mode deposit (docs/contract.md, sections 9 and 11).
// Input { session_id }. Output { booking_id, status }.
// No user auth: the Checkout Session, fetched from Stripe with our key, is the proof.
// The Payment Link carries the quote id as client_reference_id.

Deno.serve(
  withSupabase({ auth: 'none' }, async (request, { supabaseAdmin: db }) => {
    const body = await readJson(request)
    const sessionId = typeof body?.session_id === 'string' ? body.session_id : null
    if (!sessionId || !/^cs_test_[A-Za-z0-9]+$/.test(sessionId)) {
      return errorJson('A test-mode Checkout session_id is required.', 400)
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) return errorJson('Stripe is not configured.', 500)

    const stripeResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    })
    if (!stripeResponse.ok) {
      console.error('Stripe lookup failed', stripeResponse.status, await stripeResponse.text())
      return errorJson('Checkout session not found.', 404)
    }
    const session = await stripeResponse.json()
    if (session.payment_status !== 'paid') return errorJson('The deposit has not been paid.', 402)

    const quoteId = session.client_reference_id
    if (typeof quoteId !== 'string') return errorJson('The payment is not linked to a quote.', 400)

    // book_quote normally creates the booking; create it here if the link was opened directly
    const { data: quote, error: quoteError } = await db
      .from('quotes')
      .select('id, jobs (homeowner_user_id)')
      .eq('id', quoteId)
      .maybeSingle()
    if (quoteError) return errorJson(quoteError.message, 500)
    const job = one(quote?.jobs)
    if (!quote || !job) return errorJson('The payment is linked to an unknown quote.', 404)

    const { data: booking, error: bookingError } = await db
      .from('bookings')
      .upsert(
        {
          quote_id: quoteId,
          homeowner_user_id: job.homeowner_user_id,
          status: 'paid',
          stripe_session_id: sessionId,
          paid_at: new Date().toISOString(),
        },
        { onConflict: 'quote_id' }
      )
      .select('id, status')
      .single()
    if (bookingError) return errorJson(bookingError.message, 500)
    return json({ booking_id: booking.id, status: booking.status })
  })
)
