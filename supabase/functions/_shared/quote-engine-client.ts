// Starts the quote-engine function for quotes without making the caller wait.

function defaultSecretKey(): string {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (keys) {
    const key = (JSON.parse(keys) as Record<string, string>).default
    if (key) return key
  }
  const key = Deno.env.get('SUPABASE_SECRET_KEY')
  if (key) return key
  throw new Error('No Supabase secret key in the environment (SUPABASE_SECRET_KEYS).')
}

export async function runQuoteEngine(quoteId: string): Promise<void> {
  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/quote-engine`, {
    method: 'POST',
    headers: { apikey: defaultSecretKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ quote_id: quoteId }),
  })
  if (!response.ok) {
    console.error(`quote-engine failed for quote ${quoteId}: ${response.status} ${await response.text()}`)
  }
}

type EdgeRuntimeGlobal = { EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void } }

// Runs quote-engine in the background: the function that calls this can return
// its response while the Edge runtime keeps the requests alive.
export function startQuoteEngine(quoteIds: string[]): void {
  const work = Promise.all(quoteIds.map(runQuoteEngine))
  ;(globalThis as EdgeRuntimeGlobal).EdgeRuntime?.waitUntil(work)
}
