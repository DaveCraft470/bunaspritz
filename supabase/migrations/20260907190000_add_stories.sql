-- Real, persisted stories — replaces lib/stories.ts's 100%-in-memory array
-- (a story's photo only ever lived as a local file:// URI on the poster's
-- own device, so nobody else could actually see it despite the "public"/
-- "friends" visibility option existing in the UI).
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_path text not null,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  text text,
  visibility text not null default 'public' check (visibility in ('public', 'friends')),
  event_id uuid references public.events (id) on delete set null,
  latitude double precision,
  longitude double precision,
  location_label text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index stories_expires_at_idx on public.stories (expires_at);
create index stories_event_id_idx on public.stories (event_id) where event_id is not null;

alter table public.stories enable row level security;

-- expires_at > now() is baked into the read policy itself (not just a
-- client-side filter) so an expired story disappears everywhere —
-- including the map and the signed-url storage policy below — without a
-- cleanup job.
create policy "read visible, unexpired stories"
  on public.stories for select
  using (
    expires_at > now()
    and (
      visibility = 'public'
      or user_id = auth.uid()
      or (visibility = 'friends' and public.are_friends(auth.uid(), user_id))
    )
  );

create policy "post your own stories"
  on public.stories for insert
  with check (user_id = auth.uid());

create policy "delete your own stories"
  on public.stories for delete
  using (user_id = auth.uid());

alter publication supabase_realtime add table public.stories;

create table public.story_views (
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

alter table public.story_views enable row level security;

create policy "see your own views or views on your story"
  on public.story_views for select
  using (
    viewer_id = auth.uid()
    or exists (select 1 from public.stories where id = story_id and user_id = auth.uid())
  );

create policy "mark yourself as a viewer"
  on public.story_views for insert
  with check (viewer_id = auth.uid());

-- Story photos are private (visibility-gated), same idiom as message-media:
-- upload under the poster's own folder, resolve to a signed URL on demand.
insert into storage.buckets (id, name, public)
values ('stories', 'stories', false)
on conflict (id) do nothing;

create policy "upload your own story media"
  on storage.objects for insert
  with check (
    bucket_id = 'stories'
    and owner = auth.uid()
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

create policy "read story media if the story is visible to you"
  on storage.objects for select
  using (
    bucket_id = 'stories'
    and exists (
      select 1 from public.stories s
      where s.media_path = objects.name
        and s.expires_at > now()
        and (
          s.visibility = 'public'
          or s.user_id = auth.uid()
          or (s.visibility = 'friends' and public.are_friends(auth.uid(), s.user_id))
        )
    )
  );

create policy "delete your own story media"
  on storage.objects for delete
  using (bucket_id = 'stories' and owner = auth.uid());
