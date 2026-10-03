import { createClient } from "@supabase/supabase-js"

// The project URL and publishable key are public by design (RLS protects the data),
// so they have defaults here. Set NEXT_PUBLIC_SUPABASE_URL and
// NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to point the app at another project.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nfcqdolutopapucpgyah.supabase.co"
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_qBD4nXjpbK-iM9ZWqC-pdA_Fkh2v6pU"

// One browser client for the whole app. The session lives in localStorage,
// and Realtime uses the signed-in user's token, so RLS applies to every read.
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

export const SUPABASE_PROJECT_URL = SUPABASE_URL
