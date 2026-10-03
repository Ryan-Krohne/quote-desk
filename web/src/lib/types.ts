// Row shapes from docs/contract.md, section 3.

export type QuoteStatus = "pending" | "waiting_for_owner" | "quoted" | "declined"

export type StructuredRule = {
  kind: "base_price" | "surcharge" | "discount" | "exclusion" | "note"
  applies_to: string
  condition: string | null
  amount: number | null
}

export type PricingRule = {
  id: string
  business_id: string
  rule_text: string
  structured_rule: StructuredRule | null
  source: "interview" | "answer"
  created_at: string
}

export type Business = {
  id: string
  owner_user_id: string | null
  name: string
  trade: string
  service_zip_codes: string[]
}

export type Job = {
  id: string
  homeowner_user_id: string
  trade: string
  description: string
  facts: Record<string, string | number | boolean | null>
  zip_code: string
  created_at: string
}

export type QuoteReason = {
  label: string
  amount: number | null
  rule_id: string | null
  reason: string
}

export type Quote = {
  id: string
  job_id: string
  business_id: string
  status: QuoteStatus
  low_price: number | null
  high_price: number | null
  conditions: string[]
  reasons: QuoteReason[]
  confidence: number | null
  decline_reason: string | null
  created_at: string
  updated_at: string
}

export type OwnerQuestion = {
  id: string
  quote_id: string
  business_id: string
  question: string
  answer: string | null
  answered_at: string | null
  created_at: string
}

export type Booking = {
  id: string
  quote_id: string
  homeowner_user_id: string
  status: "pending_payment" | "paid"
  stripe_session_id: string | null
  paid_at: string | null
  created_at: string
}
