import 'jsr:@supabase/functions-js@2.108.2/edge-runtime.d.ts'

import { withSupabase } from 'npm:@supabase/server@1'

import { generateQuote } from '../_shared/claude.ts'
import { errorJson, json, one, readJson } from '../_shared/http.ts'

// Prices one quote (docs/contract.md, section 9). Called only by other
// functions, with the project's secret key in the apikey header.
//
// Input { quote_id }. Output { status }.
// - pending  -> quoted, declined, or waiting_for_owner (with one new owner_questions row)
// - any other status is returned unchanged, so a repeated call is harmless.
// Never waits for the owner: answer-question sets the quote back to pending
// and calls this function again.

const MIN_CONFIDENCE = 0.7

Deno.serve(
  withSupabase({ auth: 'secret' }, async (request, { supabaseAdmin: db }) => {
    const body = await readJson(request)
    const quoteId = typeof body?.quote_id === 'string' ? body.quote_id : null
    if (!quoteId) return errorJson('quote_id is required.', 400)

    const { data: quote, error: quoteError } = await db
      .from('quotes')
      .select('id, status, business_id, jobs (trade, description, facts, zip_code), businesses (name, trade)')
      .eq('id', quoteId)
      .maybeSingle()
    if (quoteError) return errorJson(quoteError.message, 500)
    if (!quote) return errorJson('Quote not found.', 404)
    if (quote.status !== 'pending') return json({ status: quote.status })

    // Only one open question per quote at a time
    const { data: questions, error: questionsError } = await db
      .from('owner_questions')
      .select('question, answer, answered_at')
      .eq('quote_id', quoteId)
      .order('created_at')
    if (questionsError) return errorJson(questionsError.message, 500)
    if (questions.some((q) => q.answered_at === null)) {
      await db.from('quotes').update({ status: 'waiting_for_owner' }).eq('id', quoteId)
      return json({ status: 'waiting_for_owner' })
    }

    const { data: rules, error: rulesError } = await db
      .from('pricing_rules')
      .select('id, rule_text, structured_rule')
      .eq('business_id', quote.business_id)
      .order('created_at')
    if (rulesError) return errorJson(rulesError.message, 500)

    let decision
    try {
      decision = await generateQuote({
        business: one(quote.businesses),
        pricing_rules: rules,
        owner_answers: questions.map((q) => ({ question: q.question, answer: q.answer })),
        job: one(quote.jobs),
      })
    } catch (error) {
      console.error(`Quote engine failed for quote ${quoteId}`, error)
      return errorJson('The quote could not be generated. Try again.', 502)
    }

    const ruleIds = new Set(rules.map((r) => r.id))
    const confidence = Math.min(1, Math.max(0, decision.confidence))
    const prices = [decision.low_price, decision.high_price]
    const pricesValid =
      prices.every((p) => typeof p === 'number' && p >= 0) && decision.low_price! <= decision.high_price!

    if (decision.decision === 'decline') {
      await db
        .from('quotes')
        .update({
          status: 'declined',
          decline_reason: decision.decline_reason ?? 'This business does not do this job.',
          confidence,
        })
        .eq('id', quoteId)
      return json({ status: 'declined' })
    }

    if (decision.decision === 'question' || confidence < MIN_CONFIDENCE || !pricesValid) {
      const question = decision.question?.trim() || 'Can you confirm the price for this job?'
      const { error: insertError } = await db
        .from('owner_questions')
        .insert({ quote_id: quoteId, business_id: quote.business_id, question })
      if (insertError) return errorJson(insertError.message, 500)
      await db.from('quotes').update({ status: 'waiting_for_owner', confidence }).eq('id', quoteId)
      return json({ status: 'waiting_for_owner' })
    }

    const { error: updateError } = await db
      .from('quotes')
      .update({
        status: 'quoted',
        low_price: decision.low_price,
        high_price: decision.high_price,
        conditions: decision.conditions,
        // Drop rule ids the model made up
        reasons: decision.reasons.map((r) => ({
          ...r,
          rule_id: r.rule_id && ruleIds.has(r.rule_id) ? r.rule_id : null,
        })),
        confidence,
        decline_reason: null,
      })
      .eq('id', quoteId)
    if (updateError) return errorJson(updateError.message, 500)
    return json({ status: 'quoted' })
  })
)
