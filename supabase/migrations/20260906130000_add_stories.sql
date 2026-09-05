-- Stories has no backend at all today — not even a client mock. Schema +
-- storage + bulk-read RPCs only; no screen exists yet to build against.

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_path text not null,
  media_type text not null check (media_type in ('image', 'video')),
  caption text not null default '',
  visibility text not null default 'friends' check (visibility in ('public', 'friends')),
  event_id uuid references public.events (id) on delete set null,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index stories_user_idx on public.stories (user_id, created_at desc);
create index stories_event_idx on public.stories (event_id) where event_id is not null;
create index stories_expires_idx on public.stories (expires_at);

alter table public.stories enable row level security;

create policy "see your own stories regardless of expiry"
  on public.stories for select
  using (user_id = auth.uid());

create policy "see others' non-expired stories you're allowed to see"
  on public.stories for select
  using (
    user_id <> auth.uid()
    and now() < expires_at
    and not public.is_blocked(user_id, auth.uid())
    and (visibility = 'public' or public.are_friends(user_id, auth.uid()))
  );

create policy "post your own stories"
  on public.stories for insert
  with check (user_id = auth.uid());

create policy "delete only your own stories"
  on public.stories for delete
  using (user_id = auth.uid());

-- No update policy — a story is immutable once posted, same as reviews.

create table public.story_views (
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

alter table public.story_views enable row level security;

-- A viewer can record their own view (RLS on `stories` above already governs
-- whether they're allowed to see the story in the first place — this insert
-- doesn't re-check visibility itself, since anyone who could SELECT the
-- story to view it has already passed that gate).
create policy "record your own view"
  on public.story_views for insert
  with check (viewer_id = auth.uid());

create policy "story owner sees who viewed it, viewer sees their own view"
  on public.story_views for select
  using (
    viewer_id = auth.uid()
    or exists (select 1 from public.stories s where s.id = story_id and s.user_id = auth.uid())
  );

insert into storage.buckets (id, name, public)
values ('stories', 'stories', false)
on conflict (id) do nothing;

create policy "upload your own story media"
  on storage.objects for insert
  with check (
    bucket_id = 'stories'
    and owner = auth.uid()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Same idiom as message-media's read policy — mirrors the stories table's
-- own visibility rule via a security-definer-backed subquery.
create policy "read story media you're allowed to see"
  on storage.objects for select
  using (
    bucket_id = 'stories'
    and exists (
      select 1 from public.stories s
      where s.media_path = storage.objects.name
        and (
          s.user_id = auth.uid()
          or (
            now() < s.expires_at
            and not public.is_blocked(s.user_id, auth.uid())
            and (s.visibility = 'public' or public.are_friends(s.user_id, auth.uid()))
          )
        )
    )
  );

create policy "delete only your own story media"
  on storage.objects for delete
  using (bucket_id = 'stories' and owner = auth.uid());

-- Bulk reads — the spec is explicit that Home/Friends/Event views must not
-- do one query per event/friend. Both join profiles inline so the client
-- gets everything it needs (avatar, name) in one round trip.
create or replace function public.home_feed_stories()
returns table (
  id uuid, user_id uuid, user_name text, user_username text, user_avatar_url text,
  media_path text, media_type text, caption text, visibility text,
  event_id uuid, lat double precision, lng double precision,
  created_at timestamptz, expires_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select s.id, s.user_id, p.name, p.username, p.avatar_url,
         s.media_path, s.media_type, s.caption, s.visibility,
         s.event_id, s.lat, s.lng, s.created_at, s.expires_at
  from public.stories s
  join public.profiles p on p.id = s.user_id
  where now() < s.expires_at
    and not public.is_blocked(s.user_id, auth.uid())
    and (
      s.user_id = auth.uid()
      or s.visibility = 'public'
      or public.are_friends(s.user_id, auth.uid())
    )
  order by s.created_at desc;
$$;

create or replace function public.event_stories(p_event_id uuid)
returns table (
  id uuid, user_id uuid, user_name text, user_username text, user_avatar_url text,
  media_path text, media_type text, caption text, visibility text,
  created_at timestamptz, expires_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select s.id, s.user_id, p.name, p.username, p.avatar_url,
         s.media_path, s.media_type, s.caption, s.visibility,
         s.created_at, s.expires_at
  from public.stories s
  join public.profiles p on p.id = s.user_id
  where s.event_id = p_event_id
    and now() < s.expires_at
    and not public.is_blocked(s.user_id, auth.uid())
    and (
      s.user_id = auth.uid()
      or s.visibility = 'public'
      or public.are_friends(s.user_id, auth.uid())
    )
  order by s.created_at desc;
$$;

grant execute on function public.home_feed_stories() to authenticated;
grant execute on function public.event_stories(uuid) to authenticated;

alter publication supabase_realtime add table public.stories;
