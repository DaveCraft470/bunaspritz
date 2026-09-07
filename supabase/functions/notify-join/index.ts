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

  const { data: event } = await admin.from('events').select('title, visibility').eq('id', eventId).single();

  // A private event's title/existence isn't meant to reach anyone beyond
  // who the host already let in — broadcasting "X joined <title>" to the
  // joiner's friends (who may have no connection to this event at all)
  // would leak exactly that.
  if (event?.visibility === 'private') return new Response('private event, no broadcast', { status: 200 });

  // friendships is a canonical (least, greatest) pair — the friend is
  // whichever column isn't the caller.
  const { data: asA } = await admin.from('friendships').select('user_b').eq('user_a', callerId);
  const { data: asB } = await admin.from('friendships').select('user_a').eq('user_b', callerId);
  const friendIds = [...(asA ?? []).map((r) => r.user_b), ...(asB ?? []).map((r) => r.user_a)];
  if (!friendIds.length) return new Response('joiner has no friends', { status: 200 });

  // A friend is excluded if THEY muted the joiner's activity, or the joiner
  // hides their own activity from THEM specifically.
  const { data: muteRows } = await admin
    .from('friend_prefs')
    .select('owner_id')
    .in('owner_id', friendIds)
    .eq('subject_id', callerId)
    .eq('mute_activity', true);
  const mutedBy = new Set((muteRows ?? []).map((row) => row.owner_id));

  const { data: hideRows } = await admin
    .from('friend_prefs')
    .select('subject_id')
    .eq('owner_id', callerId)
    .in('subject_id', friendIds)
    .eq('hide_activity_from', true);
  const hiddenFrom = new Set((hideRows ?? []).map((row) => row.subject_id));

  const recipients = friendIds.filter((id) => !mutedBy.has(id) && !hiddenFrom.has(id));
  if (!recipients.length) return new Response('no eligible recipients', { status: 200 });

  const title = 'Prieten la Spritz!';
  const body = `${joiner.name} a intrat la ${event?.title ?? 'un Spritz'}!`;

  await admin.from('notifications').insert(
    recipients.map((recipientId) => ({
      recipient_id: recipientId,
      actor_id: callerId,
      type: 'event_join',
      title,
      body,
      data: { target_id: eventId },
    }))
  );

  const { data: tokens } = await admin.from('push_tokens').select('token').in('user_id', recipients);
  await sendExpoPush((tokens ?? []).map((t) => t.token), title, body);

  return new Response('ok', { status: 200 });
});
