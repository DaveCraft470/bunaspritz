-- app/organizer-participants/[id].tsx's requestKick() currently does a local
-- setAttendees filter with a comment saying it needs exactly this RPC —
-- "Eliminarea este doar locală momentan. Persistența sigură necesită un RPC
-- Supabase...". event_attendees' own RLS only lets a user delete their own
-- row (leave), so a host removing someone else's row needs a security
-- definer function that checks host_id itself.

create or replace function public.kick_event_participant(p_event_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_id uuid;
begin
  select host_id into v_host_id from public.events where id = p_event_id;

  if v_host_id is null then
    raise exception 'event not found';
  end if;
  if v_host_id <> auth.uid() then
    raise exception 'only the host can remove a participant';
  end if;
  if p_user_id = v_host_id then
    raise exception 'the host cannot kick themselves';
  end if;

  delete from public.event_attendees where event_id = p_event_id and user_id = p_user_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'kick_participant', 'event', p_event_id, jsonb_build_object('user_id', p_user_id));
end;
$$;

grant execute on function public.kick_event_participant(uuid, uuid) to authenticated;
