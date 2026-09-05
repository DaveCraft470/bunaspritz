-- The event creator was location-locked to wherever the host happened to be
-- standing, had no way to schedule a real start time, and no way to say
-- what anything costs. All three become real columns instead of being
-- crammed into the free-text `detail` field.

alter table public.events
  add column starts_at timestamptz,
  add column entry_fee_ron numeric(10, 2),
  add column drinks_price_ron numeric(10, 2),
  add constraint events_entry_fee_non_negative check (entry_fee_ron is null or entry_fee_ron >= 0),
  add constraint events_drinks_price_non_negative check (drinks_price_ron is null or drinks_price_ron >= 0);
