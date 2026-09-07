-- Chat GIFs (remote Giphy URLs, no upload) and view-once photos for DMs,
-- plus image/GIF support for group chat (previously text-only).
--
-- media_url is distinct from the existing media_path: media_path always
-- points at a private message-media Storage object (signed URLs minted on
-- demand), while media_url is a plain public CDN URL (Giphy) stored
-- directly — no upload/re-host needed. A message has at most one of the two.
alter table public.messages add column media_url text;
alter table public.messages add column view_once boolean not null default false;
alter table public.messages add column viewed_at timestamptz;

alter table public.messages drop constraint messages_media_type_check;
alter table public.messages add constraint messages_media_type_check
  check (media_type = any (array['image', 'audio', 'gif']));

alter table public.messages drop constraint messages_media_path_matches_type;
alter table public.messages add constraint messages_media_path_matches_type
  check ((media_type is null) = (media_path is null and media_url is null));

alter table public.messages add constraint messages_media_path_or_url
  check (media_path is null or media_url is null);

-- view_once only makes sense on an actual image/gif attachment.
alter table public.messages add constraint messages_view_once_only_for_visual
  check (view_once = false or media_type in ('image', 'gif'));

-- Group chat gets image + GIF support (not voice notes, not view-once —
-- "viewed by whom" is ambiguous once there's more than one recipient).
alter table public.event_group_messages add column media_path text;
alter table public.event_group_messages add column media_type text;
alter table public.event_group_messages add column media_url text;

alter table public.event_group_messages add constraint event_group_messages_media_type_check
  check (media_type is null or media_type in ('image', 'gif'));
alter table public.event_group_messages add constraint event_group_messages_media_path_matches_type
  check ((media_type is null) = (media_path is null and media_url is null));
alter table public.event_group_messages add constraint event_group_messages_media_path_or_url
  check (media_path is null or media_url is null);

-- Group photos reuse the same message-media bucket (uploaded under the
-- sender's own folder, so the existing "upload your own message media"
-- policy already covers it) but need their own read policy — the existing
-- one only checks the messages table, which group photos never appear in.
create policy "read group message media if attendee"
  on storage.objects for select
  using (
    bucket_id = 'message-media'
    and exists (
      select 1 from public.event_group_messages egm
      join public.event_attendees ea on ea.event_id = egm.event_id
      where egm.media_path = objects.name and ea.user_id = auth.uid()
    )
  );
