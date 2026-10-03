-- Quote Desk demo seed data. Fake businesses only.
--
-- Needs the demo accounts to exist first (see "Demo accounts" in CLAUDE.md).
-- Owners are looked up by email, so no generated IDs are hard-coded.
--
-- The demo trade is water heater replacement (plumbing).
-- Old Town has no venting rule on purpose: its desk must ask the owner
-- "Is the venting standard?" during the demo (design doc, section 12).

insert into public.businesses (owner_user_id, name, trade, service_zip_codes)
select u.id, b.name, 'plumbing', b.zips
from (values
  ('owner.northside@quotedesk.test', 'Northside Plumbing & Heating', array['94103', '94107', '94110']),
  ('owner.blueline@quotedesk.test',  'Blue Line Plumbing',           array['94107', '94110', '94114']),
  ('owner.oldtown@quotedesk.test',   'Old Town Water Heaters',       array['94103', '94107'])
) as b(email, name, zips)
join auth.users u on u.email = b.email;

-- structured_rule shapes:
--   base_price: { type, applies_to, low, high }
--   add_on:     { type, when, low, high }
--   condition:  { type, when, action }
insert into public.pricing_rules (business_id, rule_text, structured_rule, source)
select bz.id, r.rule_text, r.structured_rule::jsonb, 'interview'
from (values
  -- Northside: mid-priced, full rule set
  ('Northside Plumbing & Heating',
   'Replacing a 40 gallon gas tank with standard venting is 1,800 to 2,300 dollars, haul-away included.',
   '{"type":"base_price","applies_to":{"fuel":"gas","capacity_gal":40,"venting":"atmospheric"},"low":1800,"high":2300}'),
  ('Northside Plumbing & Heating',
   'A 50 gallon gas tank with standard venting is 2,000 to 2,600 dollars.',
   '{"type":"base_price","applies_to":{"fuel":"gas","capacity_gal":50,"venting":"atmospheric"},"low":2000,"high":2600}'),
  ('Northside Plumbing & Heating',
   'Power vent units add 600 to 900 dollars.',
   '{"type":"add_on","when":{"venting":"power_vent"},"low":600,"high":900}'),
  ('Northside Plumbing & Heating',
   'If there is no expansion tank, add one for 250 dollars.',
   '{"type":"add_on","when":{"expansion_tank":false},"low":250,"high":250}'),
  ('Northside Plumbing & Heating',
   'The city permit is 150 dollars on every replacement.',
   '{"type":"add_on","when":{},"low":150,"high":150}'),

  -- Blue Line: cheaper base, more conditions
  ('Blue Line Plumbing',
   'A 40 gallon gas tank swap is 1,600 to 2,000 dollars.',
   '{"type":"base_price","applies_to":{"fuel":"gas","capacity_gal":40,"venting":"atmospheric"},"low":1600,"high":2000}'),
  ('Blue Line Plumbing',
   'A 50 gallon gas tank swap is 1,850 to 2,300 dollars.',
   '{"type":"base_price","applies_to":{"fuel":"gas","capacity_gal":50,"venting":"atmospheric"},"low":1850,"high":2300}'),
  ('Blue Line Plumbing',
   'Power vent adds 700 to 1,000 dollars.',
   '{"type":"add_on","when":{"venting":"power_vent"},"low":700,"high":1000}'),
  ('Blue Line Plumbing',
   'Seismic straps are required by code. Add 120 dollars if they are missing.',
   '{"type":"add_on","when":{"seismic_straps":false},"low":120,"high":120}'),
  ('Blue Line Plumbing',
   'Haul-away of the old tank is 90 dollars.',
   '{"type":"add_on","when":{},"low":90,"high":90}'),
  ('Blue Line Plumbing',
   'If the heater is more than 12 years old, we quote replacement only, not repair.',
   '{"type":"condition","when":{"age_years_gt":12},"action":"replace_only"}'),

  -- Old Town: no venting rule, so the desk has to ask the owner
  ('Old Town Water Heaters',
   'A 40 gallon gas water heater installed is 1,700 to 2,100 dollars.',
   '{"type":"base_price","applies_to":{"fuel":"gas","capacity_gal":40},"low":1700,"high":2100}'),
  ('Old Town Water Heaters',
   'A 50 gallon gas water heater installed is 1,950 to 2,400 dollars.',
   '{"type":"base_price","applies_to":{"fuel":"gas","capacity_gal":50},"low":1950,"high":2400}'),
  ('Old Town Water Heaters',
   'Permit and haul-away are included in the price.',
   '{"type":"add_on","when":{},"low":0,"high":0}')
) as r(business_name, rule_text, structured_rule)
join public.businesses bz on bz.name = r.business_name;
