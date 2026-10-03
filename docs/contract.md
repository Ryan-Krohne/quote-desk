# Quote Desk: Data Contract

**Issue:** #2
**Owners:** Adam (`/web`), Ryan (`/supabase`)
**Status:** Draft. Both people must agree before phase 1 starts.

This file is the shared interface between the frontend and the backend. If you change it, open a PR with squash merge and tell the other person.

---

## 1. Repo layout

| Path | Owner | Contents |
|---|---|---|
| `/web` | Adam | SvelteKit app (`adapter-vercel`), Tailwind, DaisyUI. Deployed to Vercel. |
| `/supabase/migrations` | Ryan | Schema, RLS, and Realtime publication |
| `/supabase/functions` | Ryan | MCP server and Edge Functions |
| `/supabase/seed.sql` | Ryan | Demo data. It must be safe to run again. |
| `/docs` | Both | Design, contract, demo script |

Commit directly to `main` in your own folder. Use a PR for `/docs` and the README.

---

## 2. Enums

| Enum | Values |
|---|---|
| `quote_status` | `pending`, `waiting_for_owner`, `quoted`, `declined` |
| `booking_status` | `pending_payment`, `paid` |
| `rule_source` | `interview`, `answer` |
| `trade` (text, not an enum) | `water_heater` |

Status changes for a quote:

```
pending ──> quoted
   │
   ├──> waiting_for_owner ──(owner answers)──> pending ──> quoted
   │
   └──> declined
```

---

## 3. Tables

All tables have `id uuid primary key default gen_random_uuid()` and `created_at timestamptz default now()`, unless noted. Prices are whole US dollars (`integer`).

### `profiles`

| Column | Type | Notes |
|---|---|---|
| `user_id` | `uuid` PK, FK `auth.users` | No `id` column |
| `display_name` | `text` | |
| `is_board_viewer` | `boolean` default `false` | Can read all demo rows (quote board, judge) |

### `businesses`

| Column | Type | Notes |
|---|---|---|
| `owner_user_id` | `uuid` FK `auth.users`, null | |
| `name` | `text` | |
| `trade` | `text` | `water_heater` |
| `service_zip_codes` | `text[]` | |

### `pricing_rules`

| Column | Type | Notes |
|---|---|---|
| `business_id` | `uuid` FK | |
| `rule_text` | `text` | The owner's words, as spoken or typed |
| `structured_rule` | `jsonb` | See §4. Best effort. Used for display. |
| `source` | `rule_source` | |

### `jobs`

| Column | Type | Notes |
|---|---|---|
| `homeowner_user_id` | `uuid` FK `auth.users` | `auth.uid()` of the MCP caller |
| `trade` | `text` | |
| `description` | `text` | The homeowner's problem, in Claude's words |
| `facts` | `jsonb` | See §5 |
| `zip_code` | `text` | |

### `quotes`

| Column | Type | Notes |
|---|---|---|
| `job_id` | `uuid` FK | |
| `business_id` | `uuid` FK | Unique with `job_id` |
| `status` | `quote_status` default `pending` | |
| `low_price` | `integer`, null | |
| `high_price` | `integer`, null | |
| `conditions` | `text[]` default `{}` | For example: "Price assumes standard venting" |
| `reasons` | `jsonb` default `[]` | See §6 |
| `confidence` | `real`, null | 0 to 1 |
| `decline_reason` | `text`, null | Set only when `declined` |
| `updated_at` | `timestamptz` | Set by a trigger |

### `owner_questions`

| Column | Type | Notes |
|---|---|---|
| `quote_id` | `uuid` FK | |
| `business_id` | `uuid` FK | Copied from the quote, for RLS and the Realtime filter |
| `question` | `text` | |
| `answer` | `text`, null | |
| `answered_at` | `timestamptz`, null | |

### `bookings`

| Column | Type | Notes |
|---|---|---|
| `quote_id` | `uuid` FK, unique | |
| `homeowner_user_id` | `uuid` FK `auth.users` | |
| `status` | `booking_status` default `pending_payment` | |
| `stripe_session_id` | `text`, null | Set by `confirm-booking` |
| `paid_at` | `timestamptz`, null | |

**Removed from the design:** `job_photos`. In claude.ai, Claude reads the photos in the chat and sends only the extracted facts. Add the table only if the fallback chat (#20) starts.

---

## 4. `structured_rule` shape

```json
{
  "kind": "base_price",
  "applies_to": "gas tank replacement, 40 to 50 gallons",
  "condition": null,
  "amount": 1400
}
```

| Field | Values |
|---|---|
| `kind` | `base_price`, `surcharge`, `discount`, `exclusion`, `note` |
| `applies_to` | Free text |
| `condition` | Free text, or `null` |
| `amount` | Integer dollars, or `null` |

The quote engine gets both `rule_text` and `structured_rule`. `rule_text` is the source of truth.

---

## 5. Job facts for `water_heater`

`list_trades` returns this list. `submit_job` returns the required facts that are missing.

| Fact | Type | Required | Values |
|---|---|---|---|
| `fuel_type` | string | Yes | `gas`, `electric`, `propane`, `unknown` |
| `tank_size_gallons` | integer | Yes | |
| `age_years` | integer | Yes | Calculate from the serial number when possible |
| `venting_type` | string | Yes | `atmospheric`, `power_vent`, `direct_vent`, `none_electric`, `unknown` |
| `location` | string | Yes | `garage`, `basement`, `closet`, `attic`, `other` |
| `leak_location` | string | No | `top`, `bottom`, `valve`, `none`, `unknown` |
| `requested_service` | string | No | `replace`, `repair`, `unsure` |
| `brand` | string | No | |
| `model_number` | string | No | |
| `access_notes` | string | No | For example: "Narrow stairs" |

---

## 6. `reasons` shape

There is one entry for each part of the price.

```json
[
  { "label": "50-gallon gas tank swap", "amount": 1400, "rule_id": "<uuid>", "reason": "Base price for gas tanks 40 to 50 gallons" },
  { "label": "Venting update", "amount": 300, "rule_id": "<uuid>", "reason": "Atmospheric venting older than 10 years" }
]
```

`rule_id` can be `null` when a part does not come from a rule.

---

## 7. Access rules (RLS)

Helper functions (Ryan): `is_board_viewer()` and `owns_business(business_id uuid)`.

| Table | Homeowner | Owner | Board viewer | Service role |
|---|---|---|---|---|
| `profiles` | Own row | Own row | Own row | All |
| `businesses` | Read all | Read all | Read all | All |
| `pricing_rules` | No access | Read and insert for own business | Read all | All |
| `jobs` | Read and insert own | Read jobs with a quote for own business | Read all | All |
| `quotes` | Read own jobs' quotes | Read own business's quotes | Read all | All |
| `owner_questions` | Read own jobs' questions | Read own business's questions | Read all | All |
| `bookings` | Read own | Read own business's bookings | Read all | All |

Clients never write `quotes`, `owner_questions` answers, or `bookings` directly. Only Edge Functions write them, with the service-role key.

**Realtime publication:** `jobs`, `quotes`, `owner_questions`, `bookings`, `pricing_rules`. Realtime applies RLS, so the board must sign in as a board viewer.

---

## 8. MCP tools

On success, each tool returns JSON as `structuredContent`, with the same JSON as text. On failure, it returns `isError: true` with a one-line message. All tools act as the signed-in homeowner.

### `list_trades`

Input: none.

```json
{ "trades": [ { "trade": "water_heater", "label": "Water heater", "facts": [ { "name": "fuel_type", "type": "string", "required": true, "values": ["gas", "electric", "propane", "unknown"] } ] } ] }
```

### `submit_job`

```json
// input
{ "trade": "water_heater", "description": "50-gallon gas heater leaking at the base", "facts": { "fuel_type": "gas" }, "zip_code": "94103" }
// output
{ "job_id": "<uuid>", "missing_facts": ["tank_size_gallons", "age_years"] }
```

To add facts, call `submit_job` again with the same `job_id` in the input. The tool updates the job.

### `request_quotes`

```json
// input
{ "job_id": "<uuid>" }
// output
{ "quotes": [ { "quote_id": "<uuid>", "business_name": "Rapid Rooter Plumbing", "status": "pending" } ] }
```

The tool fails if required facts are missing. It starts `quote-engine` for each quote and does not wait.

### `get_quotes`

```json
// input
{ "job_id": "<uuid>" }
// output
{
  "job_id": "<uuid>",
  "all_final": false,
  "quotes": [
    {
      "quote_id": "<uuid>",
      "business_name": "Valley Water Heaters",
      "status": "quoted",
      "low_price": 1650,
      "high_price": 1900,
      "conditions": ["Price assumes standard venting"],
      "reasons": [],
      "confidence": 0.86,
      "open_question": null,
      "decline_reason": null
    }
  ]
}
```

`all_final` is `true` when every quote is `quoted` or `declined`. Claude calls `get_quotes` again until it is `true`. Claude ranks the quotes in the chat.

### `book_quote`

```json
// input
{ "quote_id": "<uuid>" }
// output
{ "booking_id": "<uuid>", "status": "pending_payment", "payment_url": "https://buy.stripe.com/test_...?client_reference_id=<quote_id>" }
```

The quote must have status `quoted`.

---

## 9. Edge Functions

The frontend calls these with `supabase.functions.invoke(name, { body })`. The user's JWT goes in the request automatically.

| Function | Caller | Auth | Input | Output |
|---|---|---|---|---|
| `speech-to-rules` | Dashboard | Owner JWT, must own `business_id` | `{ business_id, transcript, source }` | `{ rules: PricingRule[] }` |
| `answer-question` | Dashboard | Owner JWT, must own the question's business | `{ question_id, answer_text }` | `{ question, new_rules: PricingRule[], quote_status }` |
| `confirm-booking` | `/booking/success` | None (`--no-verify-jwt`). Stripe verifies. | `{ session_id }` | `{ booking_id, status }` |
| `quote-engine` | Other functions only | Service role | `{ quote_id }` | `{ status }` |

`PricingRule` is a full `pricing_rules` row.

**`answer-question`:** saves the answer, creates rules with `source = 'answer'`, sets the quote back to `pending`, and runs `quote-engine` again.

**`quote-engine`:** Model `claude-sonnet-5-5`. If `confidence < 0.7`, or a needed fact or rule is missing, it inserts an `owner_questions` row and sets the status to `waiting_for_owner`. It asks only one open question for each quote at a time.

**`speech-to-rules`:** Model `claude-haiku-4-5-20251001`.

**`confirm-booking`:** gets the Checkout Session from Stripe with `session_id`. It checks `payment_status = 'paid'`, reads `client_reference_id` as the `quote_id`, and sets the booking to `paid`. This needs the Stripe test secret key in Supabase secrets.

---

## 10. Realtime subscriptions

| Screen | Table | Events | Filter |
|---|---|---|---|
| Dashboard | `owner_questions` | INSERT, UPDATE | `business_id=eq.<id>` |
| Dashboard | `pricing_rules` | INSERT | `business_id=eq.<id>` |
| Board | `jobs` | INSERT | none. Show the latest job. |
| Board | `quotes` | INSERT, UPDATE | `job_id=eq.<latest job>` |
| Board | `owner_questions` | INSERT, UPDATE | none. Match on `quote_id` on the client. |
| Board | `bookings` | INSERT, UPDATE | none. Match on `quote_id` on the client. |

---

## 11. Stripe

- Test mode only. Adam owns the account.
- One Payment Link with a fixed $50 deposit.
- After-payment redirect: `<vercel-url>/booking/success?session_id={CHECKOUT_SESSION_ID}`
- `book_quote` adds `?client_reference_id=<quote_id>` to the link.
- Supabase secrets (Ryan sets them, Adam gives the values): `STRIPE_PAYMENT_LINK_URL`, `STRIPE_SECRET_KEY` (a test restricted key with read access to Checkout Sessions).

---

## 12. Seed data

| Business | Owner login | Starting rules |
|---|---|---|
| Rapid Rooter Plumbing | Adam | Few. It asks about venting. |
| Bright Spark Heating & Water | Ryan | Few. It asks a question. |
| Valley Water Heaters | Judge | Full. It quotes with no question. |

| Account | Role | Notes |
|---|---|---|
| Homeowner | Homeowner | Fake name and address. Used for claude.ai OAuth. |
| Board | `is_board_viewer = true` | Signed in on the stage screen |
| Judge | Owner of Valley Water Heaters, `is_board_viewer = true` | Goes in the submission form |

- Demo ZIP code for every business: `94103`.
- All accounts use email and password. Use `@example.com` emails, with email confirmation off for seeded users.
- Share passwords directly between team members. **Never commit them.**

---

## 13. Environment variables

| Where | Name | Value from |
|---|---|---|
| Vercel | `PUBLIC_SUPABASE_URL` | Ryan |
| Vercel | `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Ryan |
| Supabase secrets | `ANTHROPIC_API_KEY` | Ryan |
| Supabase secrets | `STRIPE_PAYMENT_LINK_URL` | Adam |
| Supabase secrets | `STRIPE_SECRET_KEY` | Adam |
