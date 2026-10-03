// Bookings paid through Stripe Checkout (test mode). The homeowner pays the
// business's price plus the Quote Desk service fee in one checkout.
//
// Price charged for the job: the high end of the quote's range, a "not to exceed"
// price. Fee: QUOTE_DESK_FEE_PERCENT (default 5) of that, rounded up to whole dollars.
//
// Secrets: STRIPE_SECRET_KEY (test key that can create and read Checkout Sessions),
// SITE_URL (the web app, for the success page; default http://localhost:3000).

// deno-lint-ignore no-explicit-any
type Db = any

export type BookingResult = {
  booking_id: string
  status: 'pending_payment' | 'paid'
  business_name: string
  service_amount: number
  fee_amount: number
  total_amount: number
  payment_url: string | null
}

export function feePercent(): number {
  const value = Number(Deno.env.get('QUOTE_DESK_FEE_PERCENT') ?? '5')
  return Number.isFinite(value) && value >= 0 ? value : 5
}

export function feeFor(serviceAmount: number): number {
  return Math.ceil((serviceAmount * feePercent()) / 100)
}

async function createCheckoutSession(params: Record<string, string>): Promise<{ id: string; url: string }> {
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) throw new Error('Booking is not set up yet: STRIPE_SECRET_KEY is missing.')
  if (!key.startsWith('sk_test_') && !key.startsWith('rk_test_')) {
    throw new Error('Only Stripe test-mode keys are allowed.')
  }
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
  const body = await response.json()
  if (!response.ok) throw new Error(`Stripe: ${body?.error?.message ?? response.status}`)
  return { id: body.id, url: body.url }
}

// Creates (or returns) the booking for a quoted quote, with a Checkout link.
export async function bookQuote(db: Db, quoteId: string, homeownerUserId: string): Promise<BookingResult> {
  const { data: quote, error } = await db
    .from('quotes')
    .select('id, status, high_price, businesses (name), jobs (trade, homeowner_user_id)')
    .eq('id', quoteId)
    .maybeSingle()
  if (error) throw error
  if (!quote) throw new Error('Quote not found.')
  if (quote.status !== 'quoted' || quote.high_price == null) {
    throw new Error(`This quote cannot be booked yet. Its status is ${quote.status}.`)
  }
  const business = Array.isArray(quote.businesses) ? quote.businesses[0] : quote.businesses
  const job = Array.isArray(quote.jobs) ? quote.jobs[0] : quote.jobs
  if (job?.homeowner_user_id !== homeownerUserId) throw new Error('Quote not found.')

  const { data: existing, error: existingError } = await db
    .from('bookings')
    .select('id, status, service_amount, fee_amount, total_amount, payment_url')
    .eq('quote_id', quoteId)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing?.payment_url || existing?.status === 'paid') {
    return {
      booking_id: existing.id,
      status: existing.status,
      business_name: business?.name ?? 'the business',
      service_amount: existing.service_amount,
      fee_amount: existing.fee_amount,
      total_amount: existing.total_amount,
      payment_url: existing.status === 'paid' ? null : existing.payment_url,
    }
  }

  const service = quote.high_price as number
  const fee = feeFor(service)
  const siteUrl = (Deno.env.get('SITE_URL') ?? 'http://localhost:3000').replace(/\/$/, '')
  const businessName = business?.name ?? 'Home service'
  const session = await createCheckoutSession({
    mode: 'payment',
    client_reference_id: quoteId,
    'metadata[quote_id]': quoteId,
    success_url: `${siteUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/`,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(service * 100),
    'line_items[0][price_data][product_data][name]': `${businessName}: ${String(job?.trade ?? 'job').replace(/_/g, ' ')}`,
    'line_items[0][price_data][product_data][description]': 'Not-to-exceed price from your quote',
    'line_items[1][quantity]': '1',
    'line_items[1][price_data][currency]': 'usd',
    'line_items[1][price_data][unit_amount]': String(fee * 100),
    'line_items[1][price_data][product_data][name]': `Quote Desk service fee (${feePercent()}%)`,
  })

  const { data: booking, error: bookingError } = await db
    .from('bookings')
    .upsert(
      {
        quote_id: quoteId,
        homeowner_user_id: homeownerUserId,
        status: 'pending_payment',
        stripe_session_id: session.id,
        service_amount: service,
        fee_amount: fee,
        total_amount: service + fee,
        payment_url: session.url,
      },
      { onConflict: 'quote_id' }
    )
    .select('id, status')
    .single()
  if (bookingError) throw bookingError

  return {
    booking_id: booking.id,
    status: booking.status,
    business_name: businessName,
    service_amount: service,
    fee_amount: fee,
    total_amount: service + fee,
    payment_url: session.url,
  }
}
