-- send_friend_request()/accept_friend_request() never checked is_blocked_by(),
-- so blocking someone didn't actually stop them from sending or getting a
-- friend request accepted -- is_blocked_by() only landed in
-- 20260907120000_friend_suggestions_and_blocking.sql, after this function was
-- first written, and nothing wired it in here. Found via code review of
-- today's session.

create or replace function public.send_friend_request(p_receiver_id uuid)
returns public.friend_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid := auth.uid();
  v_reverse_id uuid;
  v_row public.friend_requests;
begin
  if v_sender is null then
    raise exception 'not authenticated';
  end if;
  if v_sender = p_receiver_id then
    raise exception 'cannot send a friend request to yourself';
  end if;
  if public.are_friends(v_sender, p_receiver_id) then
    raise exception 'already friends';
  end if;
  if public.is_blocked_by(p_receiver_id, v_sender) or public.is_blocked_by(v_sender, p_receiver_id) then
    raise exception 'cannot send a friend request to this user';
  end if;

  select id into v_reverse_id
  from public.friend_requests
  where sender_id = p_receiver_id and receiver_id = v_sender and status = 'pending';

  if v_reverse_id is not null then
    update public.friend_requests
      set status = 'accepted', updated_at = now()
      where id = v_reverse_id
      returning * into v_row;

    insert into public.friendships (user_a, user_b)
      values (least(v_sender, p_receiver_id), greatest(v_sender, p_receiver_id))
      on conflict do nothing;

    return v_row;
  end if;

  insert into public.friend_requests (sender_id, receiver_id, status)
  values (v_sender, p_receiver_id, 'pending')
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.accept_friend_request(p_request_id uuid)
returns public.friend_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.friend_requests;
begin
  select * into v_row
  from public.friend_requests
  where id = p_request_id and receiver_id = auth.uid() and status = 'pending';

  if not found then
    raise exception 'no pending request found';
  end if;

  if public.is_blocked_by(v_row.receiver_id, v_row.sender_id) or public.is_blocked_by(v_row.sender_id, v_row.receiver_id) then
    raise exception 'cannot accept a friend request involving a blocked user';
  end if;

  update public.friend_requests
    set status = 'accepted', updated_at = now()
    where id = p_request_id
    returning * into v_row;

  insert into public.friendships (user_a, user_b)
    values (least(v_row.sender_id, v_row.receiver_id), greatest(v_row.sender_id, v_row.receiver_id))
    on conflict do nothing;

  return v_row;
end;
$$;
