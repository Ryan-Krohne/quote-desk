// Claude API calls used by the Edge Functions. ANTHROPIC_API_KEY is a Supabase secret.

import Anthropic from 'npm:@anthropic-ai/sdk@0.131.0'
import { betaZodOutputFormat } from 'npm:@anthropic-ai/sdk@0.131.0/helpers/beta/zod'
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@0.131.0/helpers/zod'
import { z } from 'npm:zod@4.6.5'

const QUOTE_MODEL = 'claude-sonnet-5-5'
const RULES_MODEL = 'claude-haiku-4-5-20251001'

const client = new Anthropic()

// ---------------------------------------------------------------------------
// Owner speech to pricing rules (Haiku)
// ---------------------------------------------------------------------------

const StructuredRule = z.object({
  kind: z.enum(['base_price', 'surcharge', 'discount', 'exclusion', 'note']),
  applies_to: z.string(),
  condition: z.string().nullable(),
  amount: z.number().int().nullable(),
})

const ExtractedRules = z.object({
  rules: z.array(z.object({ rule_text: z.string(), structured_rule: StructuredRule })),
})

export type ExtractedRule = z.infer<typeof ExtractedRules>['rules'][number]

const RULES_SYSTEM = `You turn a home service business owner's spoken words into pricing rules.

Each rule is one statement about price or scope. For each rule return:
- rule_text: the owner's statement as one clear sentence, in the owner's terms. Keep every number and range.
- structured_rule: kind (base_price, surcharge, discount, exclusion, note), applies_to (which jobs), condition (when it applies, or null), amount (whole US dollars, or null; for a range use the low end).

Only record what the owner said. Do not add prices, rules or assumptions of your own.
Ignore filler, greetings and anything that is not about price or scope.`

export async function extractRules(text: string, context?: string): Promise<ExtractedRule[]> {
  const content = context ? `${context}\n\nOwner's words:\n${text}` : `Owner's words:\n${text}`
  const response = await client.messages.parse({
    model: RULES_MODEL,
    max_tokens: 4096,
    system: RULES_SYSTEM,
    messages: [{ role: 'user', content }],
    output_config: { format: zodOutputFormat(ExtractedRules) },
  })
  if (!response.parsed_output) {
    throw new Error(`Rule extraction returned no rules (stop_reason: ${response.stop_reason}).`)
  }
  return response.parsed_output.rules
}

// ---------------------------------------------------------------------------
// Quote generation (Sonnet)
// ---------------------------------------------------------------------------

const QuoteDecision = z.object({
  decision: z.enum(['quote', 'question', 'decline']),
  low_price: z.number().int().nullable(),
  high_price: z.number().int().nullable(),
  conditions: z.array(z.string()),
  reasons: z.array(
    z.object({
      label: z.string(),
      amount: z.number().int().nullable(),
      rule_id: z.string().nullable(),
      reason: z.string(),
    })
  ),
  confidence: z.number(),
  question: z.string().nullable(),
  decline_reason: z.string().nullable(),
})

export type QuoteDecision = z.infer<typeof QuoteDecision>

const QUOTE_SYSTEM = `You are the quote desk for one home service business. You price a job packet using only this business's pricing rules.

Rules:
- Use only the business's pricing rules, the owner's earlier answers, and the job facts. Never invent a price, a surcharge or a fact.
- If a fact or rule you need to price the job is missing or unclear, set decision to "question" and write one short question for the business owner (for example: "Is the venting standard?"). Ask the owner, not the homeowner. Ask about one thing only.
- If the rules say the business does not do this job, set decision to "decline" and give decline_reason.
- Otherwise set decision to "quote":
  - low_price and high_price: the total in whole US dollars. Add the low ends for low_price and the high ends for high_price.
  - reasons: one entry for each part of the price. label is a short name, amount is whole dollars for that part (the low end of a range), rule_id is the id of the rule it comes from (or null), reason explains why it applies to this job.
  - conditions: the assumptions the price depends on, for example "Price assumes standard venting".
- confidence: 0 to 1, how sure you are that the price is right for this job. If it is below 0.7, set decision to "question" and ask what would make you sure.
- Fields that do not apply to the decision are null (or an empty list).`

export async function generateQuote(packet: unknown): Promise<QuoteDecision> {
  const response = await client.beta.messages.parse({
    model: QUOTE_MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: QUOTE_SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(packet, null, 2) }],
    output_config: { effort: 'medium', format: betaZodOutputFormat(QuoteDecision) },
  })
  if (response.stop_reason === 'refusal') {
    throw new Error(`Quote request was declined by the model (${response.stop_details?.category ?? 'no category'}).`)
  }
  if (!response.parsed_output) {
    throw new Error(`Quote generation returned no decision (stop_reason: ${response.stop_reason}).`)
  }
  return response.parsed_output
}
