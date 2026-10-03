// Calls the homeowner once every quote for their job is final (quoted or declined).
// The call reads the best quote and offers "press 1 to book"; call-webhook handles
// the key press, the booking and the payment text. The phone row is deleted when
// the call ends. Only numbers on NOTIFY_ALLOWED_NUMBERS are ever called (twilio.ts).

import { feeFor } from './checkout.ts'
import { placeCall, say } from './twilio.ts'

// deno-lint-ignore no-explicit-any
type Db = any

const FINAL = new Set(['quoted', 'declined'])

function dollars(amount: number): string {
  return `${amount.toLocaleString('en-US')} dollars`
}

export function webhookUrl(params: Record<string, string>): string {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/call-webhook?${new URLSearchParams(params)}`
}

// Places the call once every quote is final. Twilio then fetches the script
// from call-webhook (step=script), which calls callScript below.
export async function maybeNotify(db: Db, jobId: string): Promise<void> {
  const { data: quotes, error } = await db.from('quotes').select('status').eq('job_id', jobId)
  if (error) throw error
  if (!quotes?.length || !quotes.every((q: { status: string }) => FINAL.has(q.status))) return

  // Claim the notification so concurrent quote-engine runs call only once.
  const { data: claimed, error: claimError } = await db
    .from('job_notifications')
    .update({ status: 'calling' })
    .eq('job_id', jobId)
    .eq('status', 'waiting')
    .select('phone')
    .maybeSingle()
  if (claimError) throw claimError
  if (!claimed) return

  try {
    const callSid = await placeCall(claimed.phone, webhookUrl({ step: 'script', job_id: jobId }))
    await db.from('job_notifications').update({ call_sid: callSid }).eq('job_id', jobId)
  } catch (callError) {
    console.error(`Call for job ${jobId} failed`, callError)
    // Delete the number either way; it is only kept for this one call.
    await db.from('job_notifications').delete().eq('job_id', jobId)
  }
}

// The TwiML the homeowner hears: the best quote, then "press 1 to book".
export async function callScript(db: Db, jobId: string): Promise<string> {
  const { data: quotes, error } = await db
    .from('quotes')
    .select('id, status, low_price, high_price, businesses (name)')
    .eq('job_id', jobId)
  if (error) throw error

  const quoted = (quotes ?? [])
    // deno-lint-ignore no-explicit-any
    .filter((q: any) => q.status === 'quoted' && q.high_price != null)
    // deno-lint-ignore no-explicit-any
    .sort((a: any, b: any) => a.high_price - b.high_price || a.low_price - b.low_price)
  // deno-lint-ignore no-explicit-any
  const name = (q: any) => (Array.isArray(q.businesses) ? q.businesses[0]?.name : q.businesses?.name) ?? 'a local business'
  const done = webhookUrl({ step: 'done', job_id: jobId }).replace(/&/g, '&amp;')

  if (quoted.length === 0) {
    return `<Response>${say(
      'Hi, this is Quote Desk. None of the local businesses could quote your job this time. Your Claude chat has the details. Goodbye.'
    )}<Redirect method="POST">${done}</Redirect></Response>`
  }

  const best = quoted[0]
  const fee = feeFor(best.high_price)
  const others = quoted.length - 1
  const intro =
    `Hi, this is Quote Desk calling about your water heater job. ` +
    `${quoted.length} ${quoted.length === 1 ? 'business' : 'businesses'} quoted. ` +
    `The best price is from ${name(best)}: ${dollars(best.low_price)} to ${dollars(best.high_price)}.` +
    (others > 0 ? ` The other ${others === 1 ? 'quote is' : 'quotes are'} in your Claude chat.` : '')
  const offer =
    `To book ${name(best)}, press 1. We will text you a payment link for ${dollars(best.high_price + fee)}: ` +
    `the not-to-exceed price of ${dollars(best.high_price)}, plus our ${dollars(fee)} service fee. ` +
    'To skip, press 2.'
  const action = webhookUrl({ step: 'gather', job_id: jobId, quote_id: best.id }).replace(/&/g, '&amp;')
  return (
    `<Response>${say(intro)}` +
    `<Gather numDigits="1" timeout="8" action="${action}" method="POST">${say(offer)}</Gather>` +
    `<Redirect method="POST">${done}</Redirect></Response>`
  )
}
