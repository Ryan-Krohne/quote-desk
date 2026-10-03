import 'jsr:@supabase/functions-js@2.108.2/edge-runtime.d.ts'

import { withSupabase } from 'npm:@supabase/server@1'

import { bookQuote } from '../_shared/checkout.ts'
import { callScript } from '../_shared/notify.ts'
import { isFromTwilio, say, sendText } from '../_shared/twilio.ts'

// Twilio webhooks for the homeowner's call (see _shared/notify.ts).
// - step=script: the call was answered. Returns what Quote Desk says.
// - step=gather: the key the homeowner pressed. 1 books the best quote and texts
//   the Stripe test-mode payment link (allowlisted numbers only, see twilio.ts).
// - step=done: no key pressed. Says goodbye.
// The phone number is deleted at the end of every path.
// No Supabase auth: Twilio signs every request, and the signature is checked.

const twiml = (body: string) => new Response(`<Response>${body}</Response>`, { headers: { 'Content-Type': 'text/xml' } })

Deno.serve(
  withSupabase({ auth: 'none' }, async (request, { supabaseAdmin: db }) => {
    const url = new URL(request.url)
    // Twilio signs the public URL it called, not the internal one.
    const publicUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/call-webhook${url.search}`
    const params = new URLSearchParams(await request.text())
    if (!(await isFromTwilio(request, publicUrl, params))) return new Response('Forbidden', { status: 403 })

    const step = url.searchParams.get('step')
    const jobId = url.searchParams.get('job_id')
    if (!jobId) return new Response('job_id is required', { status: 400 })

    const forgetNumber = () => db.from('job_notifications').delete().eq('job_id', jobId)

    if (step === 'script') {
      try {
        return new Response(await callScript(db, jobId), { headers: { 'Content-Type': 'text/xml' } })
      } catch (error) {
        console.error('Call script failed', error)
        await forgetNumber()
        return twiml(say('Sorry, something went wrong. Your quotes are in your Claude chat. Goodbye.'))
      }
    }

    if (step === 'done') {
      await forgetNumber()
      return twiml(say('No problem. Your quotes are waiting in your Claude chat. Goodbye.'))
    }

    const quoteId = url.searchParams.get('quote_id')
    if (step !== 'gather' || !quoteId) return new Response('Unknown step', { status: 400 })

    if (params.get('Digits') !== '1') {
      await forgetNumber()
      return twiml(say('No problem. Your quotes are waiting in your Claude chat. Goodbye.'))
    }

    const { data: notification } = await db.from('job_notifications').select('phone').eq('job_id', jobId).maybeSingle()
    const { data: job } = await db.from('jobs').select('homeowner_user_id').eq('id', jobId).maybeSingle()
    await forgetNumber()
    if (!job) return twiml(say('Sorry, we could not find your job. Please book in your Claude chat. Goodbye.'))

    let booking
    try {
      booking = await bookQuote(db, quoteId, job.homeowner_user_id)
    } catch (error) {
      console.error('Booking from the call failed', error)
      return twiml(say('Sorry, we could not book that quote. Please try again in your Claude chat. Goodbye.'))
    }
    if (booking.status === 'paid') return twiml(say('Good news: this job is already booked and paid. Goodbye.'))

    let texted = false
    if (notification?.phone && booking.payment_url) {
      try {
        await sendText(
          notification.phone,
          `Quote Desk: book ${booking.business_name} for $${booking.total_amount.toLocaleString('en-US')} ` +
            `($${booking.service_amount.toLocaleString('en-US')} not-to-exceed price + $${booking.fee_amount} service fee). ` +
            `Pay here: ${booking.payment_url}`
        )
        texted = true
      } catch (error) {
        console.error('Payment text failed', error)
      }
    }

    return twiml(
      say(
        texted
          ? `Done. We just texted you a link to pay ${booking.total_amount.toLocaleString('en-US')} dollars. Thanks for using Quote Desk. Goodbye.`
          : 'Your booking is ready. The payment link is in your Claude chat. Thanks for using Quote Desk. Goodbye.'
      )
    )
  })
)
