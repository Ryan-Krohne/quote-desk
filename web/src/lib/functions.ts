import { FunctionsHttpError } from "@supabase/supabase-js"

import { supabase } from "@/lib/supabase"

// Calls an Edge Function and turns its { error } body into a readable message.
export async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body })
  if (!error) return { data, error: null }
  if (error instanceof FunctionsHttpError) {
    const payload = await error.context.json().catch(() => null)
    return { data: null, error: payload?.error ?? payload?.message ?? error.message }
  }
  return { data: null, error: error.message }
}
