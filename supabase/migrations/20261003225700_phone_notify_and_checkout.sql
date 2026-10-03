-- Phone notification and per-booking checkout with a Quote Desk service fee
--
-- job_notifications: the homeowner's phone number for one job, so the backend can
-- call them when every quote is final. Only Edge Functions (service role) read
-- or write it: RLS is on with no client policies, so no browser or board can see
-- the number. The row is deleted when the call ends.
--
-- bookings: the amounts charged through Stripe Checkout. total = service + fee.

create table public.job_notifications (
  job_id uuid primary key references public.jobs (id) on delete cascade,
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  status text not null default 'waiting' check (status in ('waiting', 'calling')),
  call_sid text,
  created_at timestamptz not null default now()
);

alter table public.job_notifications enable row level security;
comment on table public.job_notifications is
  'Service role only. No client policies on purpose: phone numbers never reach a browser.';

alter table public.bookings
  add column service_amount integer,
  add column fee_amount integer,
  add column total_amount integer,
  add column payment_url text;
