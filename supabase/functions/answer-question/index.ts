import 'jsr:@supabase/functions-js@2.108.2/edge-runtime.d.ts'

import { withSupabase } from 'npm:@supabase/server@1'

import { extractRules } from '../_shared/claude.ts'
import { errorJson, json, one, readJson } from '../_shared/http.ts'
import { startQuoteEngine } from '../_shared/quote-engine-client.ts'

// Owner dashboard: the owner answers a question from their desk (docs/contract.md, section 9).
// Input { question_id, answer_text }. Output { question, new_rules, quote_status }.
// Saves the answer, turns it into rules (source 'answer'), sets the quote back
// to pending and starts quote-engine again without waiting for it.

Deno.serve(
  withSupabase({ auth: 'user' }, async (request, { supabaseAdmin: db, userClaims }) => {
    const body = await readJson(request)
    const questionId = typeof body?.question_id === 'string' ? body.question_id : null
    const answerText = typeof body?.answer_text === 'string' ? body.answer_text.trim() : ''
    if (!questionId || !answerText) return errorJson('question_id and answer_text are required.', 400)

    const { data: question, error: questionError } = await db
      .from('owner_questions')
      .select('id, quote_id, business_id, question, answered_at, businesses (name, trade, owner_user_id)')
      .eq('id', questionId)
      .maybeSingle()
    if (questionError) return errorJson(questionError.message, 500)
    const business = one(question?.businesses)
    // Same response for "missing" and "not yours", so ids cannot be probed
    if (!question || !business || business.owner_user_id !== userClaims!.id) {
      return errorJson('Question not found.', 404)
    }
    if (question.answered_at) return errorJson('This question has already been answered.', 409)

    let extracted
    try {
      extracted = await extractRules(
        answerText,
        `Business: ${business.name} (trade: ${business.trade}).\n` +
          `The quote desk asked the owner: "${question.question}"\n` +
          'Write the answer as rules that apply to future jobs like this one. Return at least one rule.'
      )
    } catch (error) {
      console.error('Rule extraction failed', error)
      return errorJson('The answer could not be read. Try again.', 502)
    }

    const { data: answered, error: answerError } = await db
      .from('owner_questions')
      .update({ answer: answerText, answered_at: new Date().toISOString() })
      .eq('id', questionId)
      .is('answered_at', null)
      .select('id, quote_id, business_id, question, answer, answered_at, created_at')
      .maybeSingle()
    if (answerError) return errorJson(answerError.message, 500)
    if (!answered) return errorJson('This question has already been answered.', 409)

    let newRules: unknown[] = []
    if (extracted.length > 0) {
      const { data, error } = await db
        .from('pricing_rules')
        .insert(extracted.map((r) => ({ business_id: question.business_id, source: 'answer', ...r })))
        .select()
      if (error) return errorJson(error.message, 500)
      newRules = data
    }

    const { error: quoteError } = await db
      .from('quotes')
      .update({ status: 'pending' })
      .eq('id', question.quote_id)
      .eq('status', 'waiting_for_owner')
    if (quoteError) return errorJson(quoteError.message, 500)

    startQuoteEngine([question.quote_id])
    return json({ question: answered, new_rules: newRules, quote_status: 'pending' })
  })
)
