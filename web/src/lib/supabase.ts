import { createClient } from "@supabase/supabase-js"

// One browser client for the whole app. The session lives in localStorage,
// and Realtime uses the signed-in user's token, so RLS applies to every read.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)
