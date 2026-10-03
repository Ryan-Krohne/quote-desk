# Quote Desk

Supabase Select 2026 hackathon project. Theme: "Build something agents want."

Quote Desk lets an AI agent (Claude) get firm quotes from home service businesses. The homeowner sends photos to Claude, Claude builds a job packet, each business's Quote Desk returns a quote or asks its owner a question first, and Claude ranks the quotes and books one with a Stripe test-mode deposit.

**The design doc is the source of truth:** `docs/quote-desk-solution-design.md`. Read it before starting any feature. If the code needs to differ from it, say so and update the doc in the same change.

**The task list is `docs/TASKS.md`.** Check it before starting work. When you finish a task, tick it in the same change. When you find new work, add it.

## Stack

- **Supabase:** Postgres with RLS, Auth (OAuth server, asymmetric JWT keys), Storage (job photos), Realtime, Edge Functions (Deno)
- **MCP server:** a Supabase Edge Function built from the MCP server block (`npx shadcn@latest add @supabase/mcp-server`). Connected to claude.ai as a custom connector.
- **Claude API**, called from Edge Functions:
  - Owner speech to pricing rules: `claude-haiku-4-5-20251001`
  - Quote generation: `claude-sonnet-5-5`
- **Web pages:** owner dashboard and quote board for the stage
- **Stripe:** test mode only (Checkout or a Payment Link)

## Repo layout

```
docs/                    Design doc and task list
supabase/migrations/     SQL migrations, named <UTC timestamp>_<name>.sql
supabase/seed.sql        Demo businesses and pricing rules (fake data)
```

Add new folders here as they are created (Edge Functions, web app).

## Supabase

- Project: "Ryan-Krohne's Project", ref `nfcqdolutopapucpgyah`, region us-east-1
- URL: `https://nfcqdolutopapucpgyah.supabase.co`

### Database rules

- Every schema change is a migration file in `supabase/migrations/`. Never change the schema by hand in the dashboard.
- Every table has RLS on. A new table needs its policies in the same migration.
- Clients write only their own rows: homeowners write jobs and photos, owners write pricing rules and answers.
- `quotes`, `owner_questions` (inserts) and `bookings` are written only by Edge Functions with the service role key. That key never goes to a browser or into the repo.
- RLS helper functions live in the `private` schema (security definer, `search_path = ''`). Use them in policies that cross tables, so the policies do not recurse.
- In policies, write `(select auth.uid())`, not `auth.uid()`.
- Quote statuses: `pending`, `waiting_for_owner`, `quoted`, `declined`.
- After any schema change, run the Supabase security and performance advisors and fix what they report.

### Demo accounts and seed data

- Four fake accounts, all with the same password. Emails and password are in the git-ignored `.env.demo`. Get the file from a teammate, never commit it.
  - `homeowner@quotedesk.test`: the demo homeowner
  - `owner.northside@quotedesk.test`: Northside Plumbing & Heating
  - `owner.blueline@quotedesk.test`: Blue Line Plumbing
  - `owner.oldtown@quotedesk.test`: Old Town Water Heaters
- `supabase/seed.sql` adds the businesses and pricing rules. It looks owners up by email, so the accounts must exist first.
- Old Town has no venting rule on purpose. Its desk must ask the owner "Is the venting standard?" in the demo.

### Edge Functions

- Edge Functions have time limits. Do not wait inside a function for an owner's answer. Set the quote to `waiting_for_owner`, then end the function. When the owner answers, run the quote again.

## MCP tools (the agent interface)

`list_trades`, `submit_job`, `request_quotes`, `get_quotes`, `book_quote`. See section 7 of the design doc for inputs and outputs.

- Return plain, typed fields. Agents must not have to parse prose.
- `submit_job` returns the missing facts, so Claude can ask the homeowner before it requests quotes.

## Quote engine prompt rules

- Use only the business's pricing rules and the job facts.
- If a needed fact is missing, return a question. Do not guess.
- Return JSON only, with a reason for each part of the price and a confidence value from 0 to 1.

## Hard rules

- **Ask before changing anything remote:** applying migrations, writing or deleting data, deploying functions, changing Auth settings. Show the SQL or command first.
- **No real personal data.** Use fake names and addresses. Photograph equipment only. This is a hackathon rule.
- **No AI phone calls to real businesses** (FCC rules on AI voices). The demo businesses are teammates or volunteers.
- **Stripe test mode only.** No live keys.
- **Never commit secrets:** no API keys, service role key or Stripe keys. Put them in Edge Function secrets or a git-ignored `.env`.
- **Claude API budget is $100.** Keep a spend limit set in the Console. Use fixed test packets and the cheapest model that works while developing.

## Build scope

Build the minimum demo first (section 4 of the design doc). Do not start stretch goals (email fallback, Link Agent Wallet, public directory) until the full demo has been rehearsed.

If the claude.ai connector or OAuth does not work within the agreed time box, switch to the fallback web chat (a page that calls the Claude API with the same tools).

## Open decisions

Tracked in section 0 of `docs/TASKS.md`.
