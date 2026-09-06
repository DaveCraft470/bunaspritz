-- "upload your own avatar" / "replace your own avatar" (see add_avatar_upload)
-- cover insert and update, but avatarUpload always calls .upload(path, bytes,
-- { upsert: true }) — and unlike the other private buckets, this bucket had
-- no SELECT policy at all, so storage-api's own row-exists check under RLS
-- (needed to decide insert vs. update) could never see anything, and every
-- upsert failed with "new row violates row-level security policy" even on a
-- path that had never been uploaded to before. Confirmed by reproducing the
-- exact request via curl: it succeeds without the upsert header, fails with
-- it, and succeeds again once this policy exists. Bucket is public anyway
-- (readable via the public CDN path regardless of RLS), so this just makes
-- the objects-table row visibility match that.
create policy "read avatars metadata"
  on storage.objects for select
  using (bucket_id = 'avatars');
