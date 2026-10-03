# Quote Desk: High-Level Solution Design

**Event:** Supabase Select 2026 Hackathon
**Theme:** "Build something agents want"
**Status:** Draft for team review

---

## 1. Summary

Quote Desk gives AI agents a standard way to request a firm quote from a home service business. Examples are an electrician, a plumber, or an HVAC technician.

A homeowner talks to Claude and sends photos of the problem. Claude builds a structured job packet. Each business has an agent-ready Quote Desk that reads the packet and returns a quote with conditions. If the packet does not have enough facts, the desk asks the business owner by voice. The answer becomes a new pricing rule. Claude compares the quotes, explains the ranking, and books the best one with a test-mode deposit.

**One-line pitch:** Google's AI can call a plumber, but the plumber cannot give a price. Quote Desk gives the plumber the facts to quote.

---

## 2. Problem

- Google Search already phones local businesses for prices and availability. In 2026, Google extended this to home repair.
- A study of these calls found that about half of the businesses gave no price. Home service businesses refused most often. They said that they must visit the home before they can quote.
- The phone call is not the hard part. The hard part is that a trade cannot quote without facts about the job.

**Result today:** Homeowners wait for site visits to compare prices. Small trades spend unpaid time on visits for jobs that they do not win.

---

## 3. Theme fit and judging criteria

| Criterion | How Quote Desk meets it |
|---|---|
| Idea | It fixes the failure in Google's feature: no price without facts. |
| Theme | Agents get a quote endpoint that they can use. Trades get requests that they can answer. |
| Design | One clear screen for each role: homeowner (in Claude), owner dashboard, and live quote board. |
| Functionality | Real sign-in, real database rows, real photos, and test-mode payments. No mockups. |
| Impact | Homeowners get comparable quotes faster. Small trades win jobs without unpaid site visits. |

**The two questions from the Anthropic slide:**

1. *How are you creating value for the world?* Homeowners and small trades both save time and money.
2. *How does this value scale with intelligence?* A smarter model reads more from a photo, asks fewer questions, and quotes more job types correctly.

**Patterns from runner-up research that this design uses:**

- The agent knows when to stop. The desk asks the owner when it is not confident.
- The agent explains itself. Each quote and each rank shows its reason.
- The demo uses a real object. A person on stage photographs a real equipment label.

---

## 4. Scope

### In scope (minimum demo)

1. A homeowner uses Claude with the Quote Desk connector.
2. Claude reads photos and builds a job packet.
3. Three demo businesses receive the packet.
4. Each Quote Desk returns a quote, or asks its owner a question first.
5. The owner answers by voice, and the answer becomes a rule.
6. Claude ranks the quotes and shows the reasons.
7. The homeowner books one quote and pays a Stripe test-mode deposit.

### Stretch goals (only if the minimum demo works)

- An email fallback for businesses without a desk: the packet plus a one-page quote form
- Link Agent Wallet spend limits for the deposit, in place of a plain test payment
- A public directory of desks that any agent can search

### Out of scope

- AI phone calls to real businesses (legal risk; see section 10)
- Real customer addresses or personal data (hackathon rules forbid sensitive personal data)
- Scheduling and calendar sync

---

## 5. Actors

| Actor | Description |
|---|---|
| Homeowner | A person with a home repair problem. Uses Claude. |
| Buyer agent | Claude, connected to the Quote Desk MCP server. Acts for the homeowner. |
| Quote Desk | Our service. One desk for each business. Reads packets and returns quotes. |
| Business owner | The trade owner. Sets pricing rules by voice and answers questions. |

---

## 6. Architecture

```
 Homeowner
    | voice + photos
    v
 Claude (claude.ai, custom connector)
    | MCP calls (OAuth, signed in as homeowner)
    v
 Quote Desk MCP server  ---- Supabase Edge Function
    |                         (built from the Supabase MCP server block)
    |
    +--> Quote engine ------- Edge Function + Claude API
    |       |
    |       +--> low confidence? --> owner_questions row
    |                                   |
    |                                   v  (Supabase Realtime)
    |                              Owner dashboard (web)
    |                                   | voice answer
    |                                   v
    |                              new pricing_rules row
    |
    +--> Postgres (jobs, quotes, rules) with RLS
    +--> Storage (job photos)
    +--> Stripe (test-mode deposit)

 Quote board (web) <---- Supabase Realtime (live quote status for the demo)
```

### Components

**1. Quote Desk MCP server**
- Built from the Supabase MCP server block (`npx shadcn@latest add @supabase/mcp-server`).
- Requires asymmetric JWT signing keys and the Supabase Auth OAuth server. Turn both on first.
- RLS decides which rows each signed-in user can read and write.

**2. Quote engine**
- An Edge Function that receives a job packet and the business's pricing rules.
- Calls the Claude API. Returns a quote range, the conditions, the reasons, and a confidence value.
- If confidence is below a set limit, it writes a question for the owner and waits.

**3. Owner dashboard (web page)**
- First use: the owner speaks the pricing rules. Claude converts the speech into structured rules.
- During the demo: questions from the desk appear live through Realtime. The owner answers by voice.
- Voice input: the browser Web Speech API. **Check that it works on the demo laptop and browser.**

**4. Quote board (web page)**
- Shows each job and each quote as it arrives. This is the screen for the stage.

**5. Payments**
- Minimum: Stripe Checkout or a Payment Link in test mode.
- Stretch: Link Agent Wallet with a spend limit.

---

## 7. MCP tools (the interface that agents use)

| Tool | Input | Output |
|---|---|---|
| `list_trades` | none | Supported trades and the facts each trade needs |
| `submit_job` | trade, description, photo references, extracted facts, ZIP code | job ID, list of missing facts |
| `request_quotes` | job ID | quote request IDs for matching businesses |
| `get_quotes` | job ID | each quote with range, conditions, reasons, and status |
| `book_quote` | quote ID | Stripe test-mode payment URL and booking status |

**Design rules for the tools:**

- Each tool returns plain, typed fields. Agents must not parse prose.
- `submit_job` returns the missing facts, so Claude can ask the homeowner before it requests quotes.
- `get_quotes` returns a status for each quote: `pending`, `waiting_for_owner`, `quoted`, or `declined`.

---

## 8. Data model (Supabase Postgres)

| Table | Purpose | Main columns |
|---|---|---|
| `businesses` | Demo trade businesses | id, owner_user_id, name, trade, service_zip_codes |
| `pricing_rules` | Rules from the owner's voice | id, business_id, rule_text, structured_rule (JSON), source (`interview` or `answer`) |
| `jobs` | Job packets | id, homeowner_user_id, trade, description, facts (JSON), zip_code |
| `job_photos` | Photo references | id, job_id, storage_path, extracted_facts (JSON) |
| `quotes` | One quote for each job and business | id, job_id, business_id, status, low_price, high_price, conditions, reasons, confidence |
| `owner_questions` | Questions from the desk to the owner | id, quote_id, question, answer, answered_at |
| `bookings` | Accepted quotes | id, quote_id, stripe_session_id, status |

### Access rules (RLS)

- A homeowner can read and write only their own jobs, photos, quotes, and bookings.
- An owner can read the jobs sent to their business, and can write only their own rules and answers.
- The quote engine writes quotes with a server-side key. Clients never get that key.

---

## 9. AI design

| Task | Where it runs | Model |
|---|---|---|
| Read photos and extract facts | Claude, in the homeowner's chat | Claude in claude.ai |
| Convert owner speech into rules | Edge Function | `claude-haiku-4-5-20251001` |
| Make a quote with reasons and confidence | Edge Function | `claude-sonnet-5-5` |
| Rank quotes and explain the rank | Claude, in the homeowner's chat | Claude in claude.ai |

**Budget:** $100 in Claude Console credits.
- Set a spend limit in the Console before any test.
- Check current prices in the Console. This design does not include price estimates.

**Prompt rules for the quote engine:**
- Use only the business's rules and the job facts.
- If a needed fact is missing, return a question. Do not guess.
- Return JSON only, with the reason for each part of the price.

---

## 10. Risks and decisions

| Risk | Impact | Mitigation |
|---|---|---|
| The claude.ai custom connector setup fails, or the OAuth flow does not complete | The buyer side does not work | Test the connector first. Fallback: a small web chat page that calls the Claude API with the same tools. |
| Voice input fails in the venue | The owner-answer step fails | Test the Web Speech API early. Keep a text box as a backup. |
| Judges say "Google already does this" | Lower idea score | Lead the pitch with the "half gave no price" finding. Our product gives trades the facts to quote. |
| AI voice calls to real businesses | Legal risk under FCC rules on AI voices | Do not call real businesses. Demo businesses are teammates or volunteers. |
| Personal data in the demo | Rule violation | Use a fake name and address. Photograph equipment only. |
| Two-sided scope is too large | Unfinished demo | Build the minimum demo first. Add stretch goals only after a full rehearsal. |
| Stripe Link Agent Wallet takes too long | Payment step fails | Use a test-mode Payment Link for the minimum demo. |

**Decision needed:** Does the homeowner use Claude in claude.ai (best story), or our fallback web chat (more control)? Recommendation: build for claude.ai, and keep the fallback ready.

---

## 11. Build order

The suggested owners are a starting point. Change them to match your skills.

| Step | Task | Suggested owner |
|---|---|---|
| 1 | Create the Supabase project. Turn on asymmetric keys and the OAuth server. Add the MCP server block. Deploy one test tool. | Teammate A |
| 2 | Connect the test tool to claude.ai as a custom connector. Confirm that sign-in works. | Teammate A |
| 3 | Create the tables and RLS policies. Add seed data for three demo businesses. | Teammate A |
| 4 | Build the owner dashboard: voice rule entry and live questions. | Teammate B |
| 5 | Build the quote engine Edge Function. Test it with fixed packets. | Teammate A |
| 6 | Add all MCP tools. Run the full flow in claude.ai. | Teammate A |
| 7 | Build the quote board for the stage. Apply the visual design. | Teammate B |
| 8 | Add the Stripe test-mode deposit. | Teammate B |
| 9 | Rehearse the full demo two times. Record a backup video. | Both |
| 10 | Submit early: description, repository, live URL, screenshots, video, and a judge login. | Both |

**Stop rule:** If step 2 fails after a fixed time box, change to the fallback web chat at once.

---

## 12. Demo script (draft)

1. **Problem (one sentence):** "Google's AI calls plumbers for prices. Half of the time, it gets no price."
2. **Homeowner:** A teammate tells Claude that the water heater leaks. The teammate photographs a real equipment label.
3. **Claude:** It reads the label, shows the extracted facts, and requests quotes.
4. **Quote board:** Two quotes arrive. Each quote shows its reasons.
5. **Owner question:** The third desk asks its owner, "Is the venting standard?" The owner answers by voice. The answer becomes a rule, and the third quote arrives.
6. **Ranking:** Claude ranks the three quotes and explains the rank.
7. **Booking:** The homeowner books the best quote and pays a test-mode deposit.
8. **Close:** "Agents want answers that they can act on. Quote Desk gives them answers that trades can stand behind."

---

## 13. Open questions for the team

1. Who owns which build steps?
2. Which trade do we use for the demo? Water heaters are a good candidate, because the label has the facts.
3. Which three demo businesses, and who plays each owner?
4. Do we know the submission deadline and the demo length?
5. Is AgentPhone or another voice partner worth using, or is the browser enough?

---

## 14. References

- Hackathon rules and judging criteria: https://hackathon.supabase.com/hackathon-rules
- Participant docs and submission tips: https://hackathon.supabase.com/docs
- Supabase "Build anything" post (MCP server block, headless app): https://supabase.com/blog/select-2026-build-anything
- Supabase MCP server guide: https://supabase.com/docs/guides/ai-tools/byo-mcp
- Stripe hackathon cheat sheet: https://shipbysundown.dev/
- Google AI calling, original announcement: https://blog.google/products/search/deep-search-business-calling-google-search/
- Study of Google AI pricing calls: https://www.invoca.com/blog/google-ai-pricing-calls-study
- FCC ruling on AI voices under the TCPA (summary): https://huntonak.com/privacy-and-information-security-law/fcc-issues-declaratory-ruling-that-tcpa-applies-to-ai-generated-voice-calls
