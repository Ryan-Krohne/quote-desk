-- Quote Desk demo seed data. Fake businesses only.
--
-- Needs the demo accounts to exist first (see "Demo accounts" in CLAUDE.md).
-- Owners are looked up by email, so no generated IDs are hard-coded.
--
-- Safe to run again: it deletes the demo jobs (with their quotes, questions and
-- bookings) and the demo businesses (with their rules), then recreates them.
-- Run it before each rehearsal to reset the demo.
--
-- The demo trade is water heater replacement.
-- Old Town has no venting rule on purpose: its desk must ask the owner
-- "Is the venting standard?" during the demo (design doc, section 12).
--
-- structured_rule shape (docs/contract.md, section 4):
--   { kind, applies_to, condition, amount }
--   kind: base_price | surcharge | discount | exclusion | note
--   amount: whole dollars or null. For a price range it is the low end;
--   rule_text keeps the full range and is the source of truth.

delete from public.jobs
where homeowner_user_id in (select id from auth.users where email = 'homeowner@quotedesk.test');

delete from public.businesses
where name in ('Northside Plumbing & Heating', 'Blue Line Plumbing', 'Old Town Water Heaters');

insert into public.businesses (owner_user_id, name, trade, service_zip_codes)
select u.id, b.name, 'water_heater', b.zips
from (values
  ('owner.northside@quotedesk.test', 'Northside Plumbing & Heating', array['94103', '94107', '94110']),
  ('owner.blueline@quotedesk.test',  'Blue Line Plumbing',           array['94103', '94107', '94114']),
  ('owner.oldtown@quotedesk.test',   'Old Town Water Heaters',       array['94103', '94107'])
) as b(email, name, zips)
join auth.users u on u.email = b.email;

insert into public.pricing_rules (business_id, rule_text, structured_rule, source)
select bz.id, r.rule_text, r.structured_rule::jsonb, 'interview'
from (values
  -- Northside: mid-priced, full rule set
  ('Northside Plumbing & Heating',
   'Replacing a 40 gallon gas tank with standard venting is 1,800 to 2,300 dollars, haul-away included.',
   '{"kind":"base_price","applies_to":"gas tank replacement, 40 gallons, standard (atmospheric) venting","condition":null,"amount":1800}'),
  ('Northside Plumbing & Heating',
   'A 50 gallon gas tank with standard venting is 2,000 to 2,600 dollars.',
   '{"kind":"base_price","applies_to":"gas tank replacement, 50 gallons, standard (atmospheric) venting","condition":null,"amount":2000}'),
  ('Northside Plumbing & Heating',
   'Power vent units add 600 to 900 dollars.',
   '{"kind":"surcharge","applies_to":"gas tank replacement","condition":"power vent","amount":600}'),
  ('Northside Plumbing & Heating',
   'If there is no expansion tank, add one for 250 dollars.',
   '{"kind":"surcharge","applies_to":"any replacement","condition":"no expansion tank","amount":250}'),
  ('Northside Plumbing & Heating',
   'The city permit is 150 dollars on every replacement.',
   '{"kind":"surcharge","applies_to":"any replacement","condition":null,"amount":150}'),

  -- Blue Line: cheaper base, more conditions
  ('Blue Line Plumbing',
   'A 40 gallon gas tank swap is 1,600 to 2,000 dollars.',
   '{"kind":"base_price","applies_to":"gas tank replacement, 40 gallons, standard (atmospheric) venting","condition":null,"amount":1600}'),
  ('Blue Line Plumbing',
   'A 50 gallon gas tank swap is 1,850 to 2,300 dollars.',
   '{"kind":"base_price","applies_to":"gas tank replacement, 50 gallons, standard (atmospheric) venting","condition":null,"amount":1850}'),
  ('Blue Line Plumbing',
   'Power vent adds 700 to 1,000 dollars.',
   '{"kind":"surcharge","applies_to":"gas tank replacement","condition":"power vent","amount":700}'),
  ('Blue Line Plumbing',
   'Seismic straps are required by code. Add 120 dollars if they are missing.',
   '{"kind":"surcharge","applies_to":"any replacement","condition":"seismic straps missing","amount":120}'),
  ('Blue Line Plumbing',
   'Haul-away of the old tank is 90 dollars.',
   '{"kind":"surcharge","applies_to":"any replacement","condition":null,"amount":90}'),
  ('Blue Line Plumbing',
   'If the heater is more than 12 years old, we quote replacement only, not repair.',
   '{"kind":"exclusion","applies_to":"repair","condition":"heater older than 12 years","amount":null}'),

  -- Old Town: no venting rule, so the desk has to ask the owner
  ('Old Town Water Heaters',
   'A 40 gallon gas water heater installed is 1,700 to 2,100 dollars.',
   '{"kind":"base_price","applies_to":"gas tank replacement, 40 gallons","condition":null,"amount":1700}'),
  ('Old Town Water Heaters',
   'A 50 gallon gas water heater installed is 1,950 to 2,400 dollars.',
   '{"kind":"base_price","applies_to":"gas tank replacement, 50 gallons","condition":null,"amount":1950}'),
  ('Old Town Water Heaters',
   'Permit and haul-away are included in the price.',
   '{"kind":"note","applies_to":"any replacement","condition":null,"amount":null}')
) as r(business_name, rule_text, structured_rule)
join public.businesses bz on bz.name = r.business_name;
