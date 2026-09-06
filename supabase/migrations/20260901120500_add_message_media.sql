-- Voice notes and photos in DMs: messages gain optional media columns, and a
-- private storage bucket holds the actual bytes.

alter table public.messages
  alter column text set default '',
  add column media_path text,
  add column media_type text check (media_type in ('image', 'audio')),
  add column duration_ms integer,
  add constraint messages_media_path_matches_type
    check ((media_type is null) = (media_path is null)),
  add constraint messages_duration_only_for_audio
    check (duration_ms is null or media_type = 'audio');

insert into storage.buckets (id, name, public)
values ('message-media', 'message-media', false)
on conflict (id) do nothing;

-- Uploaded to `{auth.uid()}/{uuid}.{ext}` by the sender, before the message
-- row exists yet (upload happens first, then the message insert points at
-- it) — so this can only check ownership of the path, not thread membership.
create policy "upload your own message media"
  on storage.objects for insert
  with check (
    bucket_id = 'message-media'
    and owner = auth.uid()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read access has to extend to the recipient too, not just the uploader —
-- this subquery hits public.messages, whose own SELECT policy already
-- scopes to "sender or recipient", so it composes safely (unlike a query
-- against event_attendees, which needed a security-definer function).
create policy "read message media you sent or received"
  on storage.objects for select
  using (
    bucket_id = 'message-media'
    and (
      owner = auth.uid()
      or exists (
        select 1 from public.messages m
        where m.media_path = storage.objects.name
          and (m.sender_id = auth.uid() or m.recipient_id = auth.uid())
      )
    )
  );

create policy "delete only your own message media"
  on storage.objects for delete
  using (bucket_id = 'message-media' and owner = auth.uid());
