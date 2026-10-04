-- Public business directory and a public, read-only quote board feed.
--
-- - businesses: profile columns (tagline, description, city, services, founded_year).
--   owner_user_id becomes nullable (docs/contract.md allows it), so directory
--   businesses can exist without a demo login.
-- - businesses and pricing_rules are readable by anyone, including visitors who are
--   not signed in. They are fake demo businesses; the rules show how each prices.
-- - board_snapshot(): the newest job and its quotes as JSON, for the stage board.
--   It returns no homeowner ids, phone numbers or payment links.

alter table public.businesses
  alter column owner_user_id drop not null,
  add column tagline text,
  add column description text,
  add column city text,
  add column services text[] not null default '{}',
  add column founded_year integer;

drop policy "Signed-in users can read businesses" on public.businesses;
create policy "Anyone can read businesses"
  on public.businesses for select to anon, authenticated
  using (true);

drop policy "Owners and board viewers can read rules" on public.pricing_rules;
create policy "Anyone can read pricing rules"
  on public.pricing_rules for select to anon, authenticated
  using (true);

create function public.board_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with latest as (
    select id, trade, description, facts, zip_code, created_at
    from public.jobs
    order by created_at desc
    limit 1
  )
  select jsonb_build_object(
    'job', (select to_jsonb(latest) from latest),
    'quotes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'status', q.status,
        'low_price', q.low_price,
        'high_price', q.high_price,
        'conditions', q.conditions,
        'reasons', q.reasons,
        'confidence', q.confidence,
        'decline_reason', q.decline_reason,
        'business_id', b.id,
        'business_name', b.name,
        'open_question', (
          select oq.question from public.owner_questions oq
          where oq.quote_id = q.id and oq.answered_at is null
          order by oq.created_at desc limit 1
        ),
        'answered', coalesce((
          select jsonb_agg(jsonb_build_object('question', oq.question, 'answer', oq.answer) order by oq.created_at)
          from public.owner_questions oq
          where oq.quote_id = q.id and oq.answered_at is not null
        ), '[]'::jsonb),
        'booking_status', (select bk.status from public.bookings bk where bk.quote_id = q.id)
      ) order by q.created_at)
      from public.quotes q
      join public.businesses b on b.id = q.business_id
      where q.job_id = (select id from latest)
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.board_snapshot() from public;
grant execute on function public.board_snapshot() to anon, authenticated;
