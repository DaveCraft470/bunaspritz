import { adminClient, getCallerId, sendExpoPush } from '../_shared/push.ts';

Deno.serve(async (req) => {
  const admin = adminClient();
  const callerId = await getCallerId(req, admin);
  if (!callerId) return new Response('unauthorized', { status: 401 });

  const { eventId } = await req.json();

  // Confirm the caller actually joined this event — don't trust the body alone.
  const { data: attendance } = await admin
    .from('event_attendees')
    .select('event_id')
    .eq('event_id', eventId)
    .eq('user_id', callerId)
    .maybeSingle();

  if (!attendance) return new Response('forbidden', { status: 403 });

  const { data: joiner } = await admin
    .from('profiles')
    .select('name, notify_friends_on_join')
    .eq('id', callerId)
    .single();

  if (!joiner?.notify_friends_on_join) {
    return new Response('joiner disabled join notifications', { status: 200 });
  }

  const { data: event } = await admin.from('events').select('title').eq('id', eventId).single();

  // Mutual friends: people the joiner follows who also follow the joiner back.
  const { data: following } = await admin.from('follows').select('followee_id').eq('follower_id', callerId);
  const followingIds = (following ?? []).map((row) => row.followee_id);
  if (!followingIds.length) return new Response('joiner has no friends', { status: 200 });

  const { data: mutualEdges } = await admin
    .from('follows')
    .select('follower_id')
    .eq('followee_id', callerId)
    .in('follower_id', followingIds);
  const mutualIds = (mutualEdges ?? []).map((row) => row.follower_id);
  if (!mutualIds.length) return new Response('joiner has no mutual friends', { status: 200 });

  // A mutual is excluded if THEY muted the joiner's activity, or the joiner
  // hides their own activity from THEM specifically.
  const { data: muteRows } = await admin
    .from('friend_prefs')
    .select('owner_id')
    .in('owner_id', mutualIds)
    .eq('subject_id', callerId)
    .eq('mute_activity', true);
  const mutedBy = new Set((muteRows ?? []).map((row) => row.owner_id));

  const { data: hideRows } = await admin
    .from('friend_prefs')
    .select('subject_id')
    .eq('owner_id', callerId)
    .in('subject_id', mutualIds)
    .eq('hide_activity_from', true);
  const hiddenFrom = new Set((hideRows ?? []).map((row) => row.subject_id));

  const recipients = mutualIds.filter((id) => !mutedBy.has(id) && !hiddenFrom.has(id));
  if (!recipients.length) return new Response('no eligible recipients', { status: 200 });

  const { data: tokens } = await admin.from('push_tokens').select('token').in('user_id', recipients);

  await sendExpoPush(
    (tokens ?? []).map((t) => t.token),
    'Prieten la Spritz!',
    `${joiner.name} a intrat la ${event?.title ?? 'un Spritz'}!`
  );

  return new Response('ok', { status: 200 });
});
