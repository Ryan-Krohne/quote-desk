-- Quote Desk: align the schema with docs/contract.md (#2, #6)
--
-- - profiles with is_board_viewer, so the stage board and the judge can read all demo rows
-- - job_photos removed (Claude reads photos in the chat and sends facts only)
-- - quotes: whole-dollar prices, text[] conditions, decline_reason
-- - owner_questions.business_id for RLS and the dashboard's Realtime filter
-- - bookings: homeowner_user_id, paid_at, statuses pending_payment and paid
-- - trade is 'water_heater'
-- - Realtime for jobs, quotes, owner_questions, bookings and pricing_rules
--
-- Only Edge Functions (service role) write quotes, owner_questions and bookings.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  is_board_viewer boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read their profile"
  on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can update their profile"
  on public.profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Users may rename themselves, but not make themselves board viewers
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

insert into public.profiles (user_id, display_name)
select id, split_part(email, '@', 1) from auth.users
on conflict (user_id) do nothing;

create function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function private.create_profile_for_new_user();

create function private.is_board_viewer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_board_viewer from public.profiles p where p.user_id = (select auth.uid())),
    false
  );
$$;

revoke execute on function private.is_board_viewer() from public, anon;
grant execute on function private.is_board_viewer() to authenticated;
revoke execute on function private.create_profile_for_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- job_photos: removed from the contract
-- ---------------------------------------------------------------------------

drop table public.job_photos;

-- ---------------------------------------------------------------------------
-- quotes
-- ---------------------------------------------------------------------------

alter table public.quotes drop constraint quotes_check;
alter table public.quotes drop constraint quotes_confidence_check;

alter table public.quotes
  alter column low_price type integer using round(low_price)::integer,
  alter column high_price type integer using round(high_price)::integer,
  alter column confidence type real using confidence::real,
  add column decline_reason text,
  add column conditions_text text[] not null default '{}';

-- jsonb array -> text[] (a type change cannot use a subquery)
update public.quotes set conditions_text = array(select jsonb_array_elements_text(conditions));
alter table public.quotes drop column conditions;
alter table public.quotes rename column conditions_text to conditions;

alter table public.quotes
  add constraint quotes_price_range_check
    check (low_price is null or high_price is null or low_price <= high_price),
  add constraint quotes_confidence_check
    check (confidence is null or (confidence >= 0 and confidence <= 1));

-- ---------------------------------------------------------------------------
-- owner_questions: business_id, copied from the quote
-- ---------------------------------------------------------------------------

alter table public.owner_questions
  add column business_id uuid references public.businesses (id) on delete cascade;

update public.owner_questions oq
set business_id = q.business_id
from public.quotes q
where q.id = oq.quote_id;

alter table public.owner_questions alter column business_id set not null;
create index on public.owner_questions (business_id);

-- Answers go through the answer-question function, not direct client writes
drop policy "Owners can answer questions" on public.owner_questions;
revoke update on public.owner_questions from authenticated;

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------

alter table public.bookings drop constraint bookings_status_check;

update public.bookings set status = 'pending_payment' where status <> 'paid';

alter table public.bookings
  add column homeowner_user_id uuid references auth.users (id) on delete cascade,
  add column paid_at timestamptz,
  alter column status set default 'pending_payment',
  add constraint bookings_status_check check (status in ('pending_payment', 'paid'));

update public.bookings b
set homeowner_user_id = j.homeowner_user_id
from public.quotes q
join public.jobs j on j.id = q.job_id
where q.id = b.quote_id;

alter table public.bookings alter column homeowner_user_id set not null;
create index on public.bookings (homeowner_user_id);

-- ---------------------------------------------------------------------------
-- Read policies: add board viewers (one policy per table and action, so the
-- planner does not evaluate several permissive policies)
-- ---------------------------------------------------------------------------

drop policy "Owners can read their rules" on public.pricing_rules;
create policy "Owners and board viewers can read rules"
  on public.pricing_rules for select to authenticated
  using (
    (select private.owns_business(business_id))
    or (select private.is_board_viewer())
  );

drop policy "Homeowners and recipient owners can read jobs" on public.jobs;
create policy "Homeowners, recipient owners and board viewers can read jobs"
  on public.jobs for select to authenticated
  using (
    homeowner_user_id = (select auth.uid())
    or (select private.job_sent_to_my_business(id))
    or (select private.is_board_viewer())
  );

drop policy "Homeowners and business owners can read quotes" on public.quotes;
create policy "Homeowners, business owners and board viewers can read quotes"
  on public.quotes for select to authenticated
  using (
    (select private.owns_job(job_id))
    or (select private.owns_business(business_id))
    or (select private.is_board_viewer())
  );

drop policy "Owners and homeowners can read questions" on public.owner_questions;
create policy "Owners, homeowners and board viewers can read questions"
  on public.owner_questions for select to authenticated
  using (
    (select private.owns_business(business_id))
    or (select private.owns_quote_job(quote_id))
    or (select private.is_board_viewer())
  );

drop policy "Homeowners and business owners can read bookings" on public.bookings;
create policy "Homeowners, business owners and board viewers can read bookings"
  on public.bookings for select to authenticated
  using (
    homeowner_user_id = (select auth.uid())
    or (select private.owns_quote_business(quote_id))
    or (select private.is_board_viewer())
  );

-- ---------------------------------------------------------------------------
-- Trade name from the contract
-- ---------------------------------------------------------------------------

update public.businesses set trade = 'water_heater' where trade = 'plumbing';

-- ---------------------------------------------------------------------------
-- Realtime (quotes and owner_questions were added in the initial schema)
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.jobs, public.bookings, public.pricing_rules;
