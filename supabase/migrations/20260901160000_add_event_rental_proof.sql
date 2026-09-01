-- Whether the host rented the venue, and an optional photo proof of that —
-- both fully optional, and deliberately without any "verified" concept:
-- nituraul8's stub had a rental_verified flag with nothing in the app that
-- could ever actually verify it (no moderator role, no review queue), which
-- would just be a fake trust badge. The photo itself stays private to the
-- host (a personal record, not a public exhibit — it may show an address,
-- a name, a payment total); only the fact that one exists is visible to
-- everyone, as a small "closed venue, not just a random spot" signal.
alter table public.events
  add column location_is_rented boolean,
  add column rental_proof_path text;

insert into storage.buckets (id, name, public)
values ('rental-proofs', 'rental-proofs', false)
on conflict (id) do nothing;

create policy "upload your own rental proof"
  on storage.objects for insert
  with check (
    bucket_id = 'rental-proofs'
    and owner = auth.uid()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "read only your own rental proof"
  on storage.objects for select
  using (bucket_id = 'rental-proofs' and owner = auth.uid());

create policy "delete only your own rental proof"
  on storage.objects for delete
  using (bucket_id = 'rental-proofs' and owner = auth.uid());
