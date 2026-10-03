// Twilio voice calls and texts. Secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
// TWILIO_FROM_NUMBER (E.164, for example +14155550123).
//
// Demo safeguard: calls and texts go only to numbers in NOTIFY_ALLOWED_NUMBERS
// (comma-separated E.164). If it is empty, nothing is ever sent.

export function isAllowedNumber(phone: string): boolean {
  const allowed = (Deno.env.get('NOTIFY_ALLOWED_NUMBERS') ?? '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
  return allowed.includes(phone)
}

function assertAllowed(phone: string) {
  if (!isAllowedNumber(phone)) throw new Error('This number is not on the demo allowlist (NOTIFY_ALLOWED_NUMBERS).')
}

function config() {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const token = Deno.env.get('TWILIO_AUTH_TOKEN')
  const from = Deno.env.get('TWILIO_FROM_NUMBER')
  if (!sid || !token || !from) throw new Error('Twilio is not set up: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER are required.')
  return { sid, token, from }
}

async function twilioPost(path: string, params: Record<string, string>) {
  const { sid, token } = config()
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
  const body = await response.json()
  if (!response.ok) throw new Error(`Twilio: ${body?.message ?? response.status}`)
  return body
}

export function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!)
}

export function say(text: string): string {
  return `<Say voice="Polly.Joanna">${escapeXml(text)}</Say>`
}

export async function placeCall(to: string, twiml: string, statusCallback: string): Promise<string> {
  assertAllowed(to)
  const { from } = config()
  const call = await twilioPost('Calls.json', {
    To: to,
    From: from,
    Twiml: twiml,
    StatusCallback: statusCallback,
    StatusCallbackEvent: 'completed',
  })
  return call.sid
}

export async function sendText(to: string, body: string): Promise<void> {
  assertAllowed(to)
  const { from } = config()
  await twilioPost('Messages.json', { To: to, From: from, Body: body })
}

// Checks X-Twilio-Signature: base64(HMAC-SHA1(auth token, url + sorted form params)).
export async function isFromTwilio(request: Request, url: string, params: URLSearchParams): Promise<boolean> {
  const signature = request.headers.get('X-Twilio-Signature')
  const token = Deno.env.get('TWILIO_AUTH_TOKEN')
  if (!signature || !token) return false
  const data = url + [...params.keys()].sort().map((k) => k + params.get(k)).join('')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(token), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)))
  const expected = btoa(String.fromCharCode(...mac))
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  return diff === 0
}

export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '')
  if (/^\+[1-9]\d{7,14}$/.test(digits)) return digits
  const plain = digits.replace(/\D/g, '')
  if (plain.length === 10) return `+1${plain}`
  if (plain.length === 11 && plain.startsWith('1')) return `+${plain}`
  return null
}
