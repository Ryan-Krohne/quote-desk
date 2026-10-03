import 'jsr:@supabase/functions-js@2.108.2/edge-runtime.d.ts'

import { withSupabase } from 'npm:@supabase/server@1'

import { extractRules } from '../_shared/claude.ts'
import { errorJson, json, readJson } from '../_shared/http.ts'

// Owner dashboard: spoken pricing rules -> pricing_rules rows (docs/contract.md, section 9).
// Input { business_id, transcript, source }. Output { rules: PricingRule[] }.
// Rows are inserted with the owner's client, so RLS checks that they own the business.

Deno.serve(
  withSupabase({ auth: 'user' }, async (request, { supabase, userClaims }) => {
    const body = await readJson(request)
    const businessId = typeof body?.business_id === 'string' ? body.business_id : null
    const transcript = typeof body?.transcript === 'string' ? body.transcript.trim() : ''
    const source = body?.source ?? 'interview'
    if (!businessId || !transcript) return errorJson('business_id and transcript are required.', 400)
    if (source !== 'interview' && source !== 'answer') {
      return errorJson("source must be 'interview' or 'answer'.", 400)
    }

    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, trade')
      .eq('id', businessId)
      .eq('owner_user_id', userClaims!.id)
      .maybeSingle()
    if (businessError) return errorJson(businessError.message, 500)
    if (!business) return errorJson('You do not own this business.', 403)

    let extracted
    try {
      extracted = await extractRules(transcript, `Business: ${business.name} (trade: ${business.trade}).`)
    } catch (error) {
      console.error('Rule extraction failed', error)
      return errorJson('The rules could not be read from the transcript. Try again.', 502)
    }
    if (extracted.length === 0) return json({ rules: [] })

    const { data: rules, error: insertError } = await supabase
      .from('pricing_rules')
      .insert(extracted.map((r) => ({ business_id: businessId, source, ...r })))
      .select()
    if (insertError) return errorJson(insertError.message, 500)
    return json({ rules })
  })
)
