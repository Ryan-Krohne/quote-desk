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
where name in (
  'Northside Plumbing & Heating', 'Blue Line Plumbing', 'Old Town Water Heaters',
  'Mission Pipe Works', 'Sunset Plumbing Co.', 'Bayview Water Heater Pros',
  'Richmond Rooter & Heat', 'Noe Valley Plumbing Collective'
);

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

-- ---------------------------------------------------------------------------
-- Directory profiles (public). The five extra businesses serve other ZIP codes,
-- so the demo job in 94103 still goes to exactly three desks.
-- ---------------------------------------------------------------------------

update public.businesses b set
  tagline = p.tagline, description = p.description, city = 'San Francisco',
  services = p.services, founded_year = p.founded_year
from (values
  ('Northside Plumbing & Heating', 'Full-service plumbing since 2004',
   'A family-run shop covering SoMa and the Mission. Northside handles gas and electric tank swaps, permits and expansion tanks, and quotes everything up front.',
   array['Water heater replacement', 'Expansion tanks', 'Permits', 'Gas lines'], 2004),
  ('Blue Line Plumbing', 'Fast, no-frills tank swaps',
   'Blue Line keeps prices low by focusing on standard tank replacements. Seismic straps and haul-away are itemized, never hidden.',
   array['Water heater replacement', 'Seismic strapping', 'Haul-away'], 2015),
  ('Old Town Water Heaters', 'Water heaters, and nothing else',
   'A specialist that only installs water heaters. Permit and haul-away are always included in the price.',
   array['Gas water heaters', 'Electric water heaters', 'Permits included'], 1998)
) as p(name, tagline, description, services, founded_year)
where b.name = p.name;

insert into public.businesses (owner_user_id, name, trade, service_zip_codes, tagline, description, city, services, founded_year)
values
  (null, 'Mission Pipe Works', 'water_heater', array['94110', '94114'], 'Tankless and high-efficiency specialists',
   'Mission Pipe Works installs tank and tankless heaters and helps homeowners move to high-efficiency units.',
   'San Francisco', array['Tankless installs', 'High-efficiency tanks', 'Recirculation pumps'], 2011),
  (null, 'Sunset Plumbing Co.', 'water_heater', array['94122', '94116'], 'Outer Sunset''s neighborhood plumber',
   'A small crew serving the Sunset and Parkside, known for same-week water heater replacements.',
   'San Francisco', array['Water heater replacement', 'Leak repair', 'Shut-off valves'], 2008),
  (null, 'Bayview Water Heater Pros', 'water_heater', array['94124', '94134'], 'Same-day emergency replacements',
   'Bayview Water Heater Pros keeps common tank sizes in stock for same-day swaps when a heater fails.',
   'San Francisco', array['Emergency replacement', 'Gas and electric tanks', 'Haul-away'], 2017),
  (null, 'Richmond Rooter & Heat', 'water_heater', array['94118', '94121'], 'Plumbing and heating for the Richmond',
   'Richmond Rooter & Heat covers drains, heating and water heaters in the Inner and Outer Richmond.',
   'San Francisco', array['Water heaters', 'Drain cleaning', 'Gas heating'], 2002),
  (null, 'Noe Valley Plumbing Collective', 'water_heater', array['94114', '94131'], 'Worker-owned and licensed',
   'A worker-owned cooperative of licensed plumbers. Flat, published prices for every standard job.',
   'San Francisco', array['Water heater replacement', 'Expansion tanks', 'Seismic strapping'], 2019);

insert into public.pricing_rules (business_id, rule_text, structured_rule, source)
select bz.id, r.rule_text, r.structured_rule::jsonb, 'interview'
from (values
  ('Mission Pipe Works', 'A 50 gallon gas tank replacement is 2,100 to 2,700 dollars.',
   '{"kind":"base_price","applies_to":"gas tank replacement, 50 gallons","condition":null,"amount":2100}'),
  ('Mission Pipe Works', 'Switching to a tankless unit is 4,200 to 5,500 dollars installed.',
   '{"kind":"base_price","applies_to":"tankless conversion","condition":null,"amount":4200}'),
  ('Mission Pipe Works', 'Permit is 175 dollars.',
   '{"kind":"surcharge","applies_to":"any replacement","condition":null,"amount":175}'),
  ('Sunset Plumbing Co.', 'A 40 or 50 gallon gas tank swap is 1,750 to 2,250 dollars.',
   '{"kind":"base_price","applies_to":"gas tank replacement, 40 to 50 gallons","condition":null,"amount":1750}'),
  ('Sunset Plumbing Co.', 'Attic installs add 400 dollars.',
   '{"kind":"surcharge","applies_to":"any replacement","condition":"heater in the attic","amount":400}'),
  ('Bayview Water Heater Pros', 'Same-day 50 gallon gas replacement is 2,300 to 2,800 dollars.',
   '{"kind":"base_price","applies_to":"gas tank replacement, 50 gallons, same day","condition":null,"amount":2300}'),
  ('Bayview Water Heater Pros', 'Haul-away is included.',
   '{"kind":"note","applies_to":"any replacement","condition":null,"amount":null}'),
  ('Richmond Rooter & Heat', 'A 40 gallon gas tank replacement is 1,650 to 2,150 dollars.',
   '{"kind":"base_price","applies_to":"gas tank replacement, 40 gallons","condition":null,"amount":1650}'),
  ('Richmond Rooter & Heat', 'Power vent units add 650 dollars.',
   '{"kind":"surcharge","applies_to":"gas tank replacement","condition":"power vent","amount":650}'),
  ('Noe Valley Plumbing Collective', 'Every standard 50 gallon gas swap is a flat 2,250 dollars, permit included.',
   '{"kind":"base_price","applies_to":"gas tank replacement, 50 gallons","condition":null,"amount":2250}'),
  ('Noe Valley Plumbing Collective', 'Expansion tank, if needed, is 225 dollars.',
   '{"kind":"surcharge","applies_to":"any replacement","condition":"no expansion tank","amount":225}')
) as r(business_name, rule_text, structured_rule)
join public.businesses bz on bz.name = r.business_name;
