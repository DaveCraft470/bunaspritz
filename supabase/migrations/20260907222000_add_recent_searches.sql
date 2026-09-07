-- Recently Searched: per-user search history for Discover (see
-- lib/recentActivity.ts). Same "definer function owns the writes" idiom as
-- record_event_view — record_search() upserts and trims to 15 rows in one
-- transaction, so no client insert policy is needed at all. Clearing the
-- whole history is a plain delete the client can do directly.
create table public.recent_searches (
  user_id uuid not null references public.profiles (id) on delete cascade,
  query text not null,
  searched_at timestamptz not null default now(),
  primary key (user_id, query)
);

create index recent_searches_user_idx on public.recent_searches (user_id, searched_at desc);

alter table public.recent_searches enable row level security;

create policy "see only your own recent searches"
  on public.recent_searches for select
  using (user_id = auth.uid());

create policy "clear your own recent searches"
  on public.recent_searches for delete
  using (user_id = auth.uid());

create or replace function public.record_search(p_query text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text := trim(p_query);
begin
  if v_query = '' then
    return;
  end if;

  insert into public.recent_searches (user_id, query, searched_at)
  values (auth.uid(), v_query, now())
  on conflict (user_id, query) do update set searched_at = excluded.searched_at;

  delete from public.recent_searches
  where user_id = auth.uid()
    and query not in (
      select query from public.recent_searches
      where user_id = auth.uid()
      order by searched_at desc
      limit 15
    );
end;
$$;

grant execute on function public.record_search(text) to authenticated;
