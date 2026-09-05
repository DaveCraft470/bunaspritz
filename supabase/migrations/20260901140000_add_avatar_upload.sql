-- profiles.avatar_url has existed since init but was never a client-writable
-- column (the lock_verified_column migration's column-level grant only
-- covers name/username/bio/notify_friends_on_join). Add it, plus a public
-- storage bucket to hold the actual image — unlike message-media, avatars
-- are meant to be visible to anyone (profile cards, chat rows, attendee
-- lists), so this bucket is public-read rather than signed-URL-gated.
grant update (avatar_url) on public.profiles to authenticated;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Uploaded to `{auth.uid()}/avatar.{ext}`, overwritten in place on every
-- change (upsert) rather than accumulating old files.
create policy "upload your own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and owner = auth.uid()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "replace your own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and owner = auth.uid())
  with check (bucket_id = 'avatars' and owner = auth.uid());
