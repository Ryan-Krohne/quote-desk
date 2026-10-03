// Small helpers for the JSON Edge Functions.

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

export function errorJson(message: string, status: number): Response {
  return Response.json({ error: message }, { status })
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

// supabase-js types a joined row as an array unless the client has generated
// types. A many-to-one join returns one object at runtime.
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}
