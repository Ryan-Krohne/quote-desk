-- Quote Desk: initial schema
-- Tables from docs/quote-desk-solution-design.md, section 8.
-- Writes to quotes, owner_questions and bookings come from Edge Functions
-- using the service role key, which bypasses RLS.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  trade text not null,
  service_zip_codes text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  rule_text text not null,
  structured_rule jsonb,
  source text not null check (source in ('interview', 'answer')),
  created_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  homeowner_user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trade text not null,
  description text not null,
  facts jsonb not null default '{}',
  zip_code text not null,
  created_at timestamptz not null default now()
);

create table public.job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  storage_path text not null,
  extracted_facts jsonb,
  created_at timestamptz not null default now()
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'waiting_for_owner', 'quoted', 'declined')),
  low_price numeric(10, 2),
  high_price numeric(10, 2),
  conditions jsonb not null default '[]',
  reasons jsonb not null default '[]',
  confidence numeric(3, 2) check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, business_id),
  check (low_price is null or high_price is null or low_price <= high_price)
);

create table public.owner_questions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  question text not null,
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references public.quotes (id) on delete cascade,
  stripe_session_id text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'cancelled')),
  created_at timestamptz not null default now()
);

-- Indexes for foreign keys and RLS lookups
create index on public.businesses (owner_user_id);
create index on public.pricing_rules (business_id);
create index on public.jobs (homeowner_user_id);
create index on public.job_photos (job_id);
create index on public.quotes (business_id);
create index on public.owner_questions (quote_id);

-- Keep quotes.updated_at current
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger quotes_set_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS helpers
-- Security definer functions in a schema the API does not expose. They let
-- policies on jobs and quotes check each other without recursive RLS.
-- ---------------------------------------------------------------------------

create schema if not exists private;

create function private.owns_business(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.owner_user_id = (select auth.uid())
  );
$$;

create function private.owns_job(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.jobs j
    where j.id = p_job_id and j.homeowner_user_id = (select auth.uid())
  );
$$;

-- True when the job was sent to one of the caller's businesses
create function private.job_sent_to_my_business(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.quotes q
    join public.businesses b on b.id = q.business_id
    where q.job_id = p_job_id and b.owner_user_id = (select auth.uid())
  );
$$;

-- True when the caller owns the quote's business
create function private.owns_quote_business(p_quote_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.quotes q
    join public.businesses b on b.id = q.business_id
    where q.id = p_quote_id and b.owner_user_id = (select auth.uid())
  );
$$;

-- True when the caller owns the quote's job
create function private.owns_quote_job(p_quote_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.quotes q
    join public.jobs j on j.id = q.job_id
    where q.id = p_quote_id and j.homeowner_user_id = (select auth.uid())
  );
$$;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------

alter table public.businesses enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.jobs enable row level security;
alter table public.job_photos enable row level security;
alter table public.quotes enable row level security;
alter table public.owner_questions enable row level security;
alter table public.bookings enable row level security;

-- businesses: any signed-in user can see businesses (needed to show quotes).
-- Owners manage only their own.
create policy "Signed-in users can read businesses"
  on public.businesses for select to authenticated
  using (true);

create policy "Owners can insert their businesses"
  on public.businesses for insert to authenticated
  with check (owner_user_id = (select auth.uid()));

create policy "Owners can update their businesses"
  on public.businesses for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

create policy "Owners can delete their businesses"
  on public.businesses for delete to authenticated
  using (owner_user_id = (select auth.uid()));

-- pricing_rules: only the business owner
create policy "Owners can read their rules"
  on public.pricing_rules for select to authenticated
  using ((select private.owns_business(business_id)));

create policy "Owners can insert their rules"
  on public.pricing_rules for insert to authenticated
  with check ((select private.owns_business(business_id)));

create policy "Owners can update their rules"
  on public.pricing_rules for update to authenticated
  using ((select private.owns_business(business_id)))
  with check ((select private.owns_business(business_id)));

create policy "Owners can delete their rules"
  on public.pricing_rules for delete to authenticated
  using ((select private.owns_business(business_id)));

-- jobs: the homeowner, plus owners of businesses the job was sent to (read only)
create policy "Homeowners and recipient owners can read jobs"
  on public.jobs for select to authenticated
  using (
    homeowner_user_id = (select auth.uid())
    or (select private.job_sent_to_my_business(id))
  );

create policy "Homeowners can insert their jobs"
  on public.jobs for insert to authenticated
  with check (homeowner_user_id = (select auth.uid()));

create policy "Homeowners can update their jobs"
  on public.jobs for update to authenticated
  using (homeowner_user_id = (select auth.uid()))
  with check (homeowner_user_id = (select auth.uid()));

create policy "Homeowners can delete their jobs"
  on public.jobs for delete to authenticated
  using (homeowner_user_id = (select auth.uid()));

-- job_photos: same access as the job
create policy "Homeowners and recipient owners can read photos"
  on public.job_photos for select to authenticated
  using (
    (select private.owns_job(job_id))
    or (select private.job_sent_to_my_business(job_id))
  );

create policy "Homeowners can insert photos"
  on public.job_photos for insert to authenticated
  with check ((select private.owns_job(job_id)));

create policy "Homeowners can delete photos"
  on public.job_photos for delete to authenticated
  using ((select private.owns_job(job_id)));

-- quotes: read only for the homeowner and the business owner.
-- Only the quote engine (service role) writes quotes.
create policy "Homeowners and business owners can read quotes"
  on public.quotes for select to authenticated
  using (
    (select private.owns_job(job_id))
    or (select private.owns_business(business_id))
  );

-- owner_questions: the business owner reads and answers; the homeowner can read.
-- The quote engine (service role) inserts questions.
create policy "Owners and homeowners can read questions"
  on public.owner_questions for select to authenticated
  using (
    (select private.owns_quote_business(quote_id))
    or (select private.owns_quote_job(quote_id))
  );

create policy "Owners can answer questions"
  on public.owner_questions for update to authenticated
  using ((select private.owns_quote_business(quote_id)))
  with check ((select private.owns_quote_business(quote_id)));

-- Owners may only change the answer columns, not the question
revoke update on public.owner_questions from authenticated;
grant update (answer, answered_at) on public.owner_questions to authenticated;

-- bookings: read only for the homeowner and the business owner.
-- book_quote (service role) creates bookings; the Stripe webhook updates them.
create policy "Homeowners and business owners can read bookings"
  on public.bookings for select to authenticated
  using (
    (select private.owns_quote_job(quote_id))
    or (select private.owns_quote_business(quote_id))
  );

-- ---------------------------------------------------------------------------
-- Realtime: live quote status and owner questions
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.quotes, public.owner_questions;
