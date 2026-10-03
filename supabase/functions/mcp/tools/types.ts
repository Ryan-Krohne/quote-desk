import type { SupabaseContext } from 'npm:@supabase/server@1'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.108.2'

// Tools read and write as the signed-in user through `supabase` (RLS applies).
// `supabaseAdmin` bypasses RLS. Use it only for the rows the contract says
// only the server writes: quotes and bookings.
export type ToolContext = {
  supabase: SupabaseClient
  supabaseAdmin: SupabaseClient
  userClaims: NonNullable<SupabaseContext['userClaims']>
  jwtClaims: NonNullable<SupabaseContext['jwtClaims']>
}
