# Quote Desk: Task List

Working checklist for the minimum demo. Built from `docs/quote-desk-solution-design.md` (section 11 build order, plus gaps found while building).

**Keep this file current.** Tick items when they are done, add new work as it appears, and put a name in the Owner column when you take an item.

Last updated: 2026-10-03

---

## 0. Team decisions (design doc, section 13)

- [ ] Who owns which build steps (fill the Owner columns below)
- [ ] Demo trade. Seed data assumes **water heater replacement (plumbing)**.
- [ ] Who plays the homeowner and each of the three business owners on stage
- [ ] Submission deadline and demo length
- [ ] Voice: browser Web Speech API only, or a partner such as AgentPhone
- [ ] Buyer side: claude.ai connector (recommended) or fallback web chat
- [ ] How the stage quote board reads data under RLS: sign in as the demo homeowner, or an Edge Function feed

## 1. Supabase foundation

| Done | Task | Owner |
|---|---|---|
| [x] | Create the Supabase project (`nfcqdolutopapucpgyah`) | Ryan |
| [x] | Tables, RLS policies, Realtime on `quotes` and `owner_questions` (migration `20261003191838_initial_schema`) | Ryan |
| [x] | Demo accounts: 1 homeowner, 3 owners (credentials in git-ignored `.env.demo`) | Ryan |
| [x] | Seed data: 3 fake plumbing businesses and their pricing rules (`supabase/seed.sql`) | Ryan |
| [ ] | Confirm asymmetric JWT signing keys are on (sign-in tokens already use ES256, so probably yes) | |
| [ ] | Turn on the Supabase Auth OAuth server | |
| [ ] | Storage bucket for job photos, with policies that match `job_photos` access | |
| [ ] | Link the repo to the project with the Supabase CLI (`supabase link`) | |

## 2. MCP server and claude.ai connector (biggest risk, do first)

| Done | Task | Owner |
|---|---|---|
| [ ] | Add the MCP server block (`npx shadcn@latest add @supabase/mcp-server`) | |
| [ ] | Deploy one test tool as an Edge Function | |
| [ ] | Add it to claude.ai as a custom connector and confirm OAuth sign-in | |
| [ ] | If this fails within the time box, switch to the fallback web chat | |

## 3. MCP tools (design doc, section 7)

| Done | Task | Owner |
|---|---|---|
| [ ] | `list_trades`: supported trades and the facts each one needs | |
| [ ] | `submit_job`: create the job and photos, return the missing facts | |
| [ ] | `request_quotes`: match businesses by trade and ZIP code, create `pending` quotes, start the quote engine | |
| [ ] | `get_quotes`: quotes with range, conditions, reasons and status | |
| [ ] | `book_quote`: create a booking and return a Stripe test-mode payment URL | |
| [ ] | Run the full flow in claude.ai | |

## 4. Quote engine

| Done | Task | Owner |
|---|---|---|
| [ ] | Claude API key in Edge Function secrets, with a spend limit set in the Console ($100 budget) | |
| [ ] | Edge Function: job packet + pricing rules → JSON quote with reasons and confidence (`claude-sonnet-5-5`) | |
| [ ] | Low confidence: write an `owner_questions` row, set the quote to `waiting_for_owner`, and end the function | |
| [ ] | When the owner answers: save the answer as a pricing rule (`source = 'answer'`) and run the quote again (trigger or webhook) | |
| [ ] | Test with fixed job packets. Old Town must ask about venting, as in the demo script. | |

## 5. Owner dashboard (web)

| Done | Task | Owner |
|---|---|---|
| [ ] | Sign-in for owners | |
| [ ] | Voice rule entry: speech → Edge Function (`claude-haiku-4-5-20251001`) → `pricing_rules` | |
| [ ] | Live questions through Realtime, answered by voice | |
| [ ] | Text box as a backup for voice | |
| [ ] | Check Web Speech API on the demo laptop and browser | |

## 6. Quote board (web, the screen for the stage)

| Done | Task | Owner |
|---|---|---|
| [ ] | Live list of jobs and quotes, with each quote's reasons | |
| [ ] | Visual design | |

## 7. Payments

| Done | Task | Owner |
|---|---|---|
| [ ] | Stripe account in test mode | |
| [ ] | Checkout or Payment Link for the deposit | |
| [ ] | Update `bookings.status` when payment completes (Stripe webhook) | |

## 8. Hosting

| Done | Task | Owner |
|---|---|---|
| [ ] | Host the web pages (Vercel, Netlify or Cloudflare Pages). A free subdomain is enough. | |
| [ ] | Add the site URL and the claude.ai callback to Supabase Auth redirect URLs | |

## 9. Demo and submission

| Done | Task | Owner |
|---|---|---|
| [ ] | Real water heater label to photograph (no personal data in the shot) | |
| [ ] | Rehearse the full demo two times | |
| [ ] | Record a backup video | |
| [ ] | Submit: description, repository, live URL, screenshots, video, judge login | |

## Stretch (only after a full rehearsal)

- [ ] Email fallback for businesses without a desk
- [ ] Link Agent Wallet spend limits for the deposit
- [ ] Public directory of desks
