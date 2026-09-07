import { adminClient, getCallerId, sendExpoPush } from '../_shared/push.ts';

// "Attends often" = has attended at least this many of the host's OTHER events.
const FREQUENT_ATTENDEE_THRESHOLD = 2;

Deno.serve(async (req) => {
  const admin = adminClient();
  const callerId = await getCallerId(req, admin);
  if (!callerId) return new Response('unauthorized', { status: 401 });

  const { eventId } = await req.json();

  const { data: event } = await admin.from('events').select('id, title, host_id, visibility').eq('id', eventId).single();
  if (!event || event.host_id !== callerId) return new Response('forbidden', { status: 403 });

  // A private event isn't meant to reach anyone beyond who the host lets in
  // directly — broadcasting it to "frequent attendees" would defeat that.
  if (event.visibility === 'private') return new Response('private event, no broadcast', { status: 200 });

  const { data: host } = await admin.from('profiles').select('name').eq('id', callerId).single();

  const { data: hostEvents } = await admin.from('events').select('id').eq('host_id', callerId).neq('id', eventId);
  const hostEventIds = (hostEvents ?? []).map((row) => row.id);
  if (!hostEventIds.length) return new Response('host has no past events', { status: 200 });

  const { data: pastAttendance } = await admin
    .from('event_attendees')
    .select('user_id, event_id')
    .in('event_id', hostEventIds);

  const attendedEventsByUser = new Map<string, Set<string>>();
  for (const row of pastAttendance ?? []) {
    const set = attendedEventsByUser.get(row.user_id) ?? new Set<string>();
    set.add(row.event_id);
    attendedEventsByUser.set(row.user_id, set);
  }

  const frequentAttendeeIds = [...attendedEventsByUser.entries()]
    .filter(([, events]) => events.size >= FREQUENT_ATTENDEE_THRESHOLD)
    .map(([userId]) => userId);

  // Follow Organizer: anyone explicitly following the host gets notified
  // too, regardless of past attendance — that's the whole point of
  // following someone instead of waiting to become a "frequent attendee".
  const { data: followRows } = await admin.from('follows').select('follower_id').eq('followee_id', callerId);
  const followerIds = (followRows ?? []).map((row) => row.follower_id);

  const frequentUserIds = [...new Set([...frequentAttendeeIds, ...followerIds])];
  if (!frequentUserIds.length) return new Response('no recipients yet', { status: 200 });

  // Excluded if THEY muted the host's activity, or the host hides their own
  // activity from THEM specifically — this second check was missing before,
  // so a host who hid their activity from someone still notified that
  // person on every new event.
  const { data: muteRows } = await admin
    .from('friend_prefs')
    .select('owner_id')
    .in('owner_id', frequentUserIds)
    .eq('subject_id', callerId)
    .eq('mute_activity', true);
  const muted = new Set((muteRows ?? []).map((row) => row.owner_id));

  const { data: hideRows } = await admin
    .from('friend_prefs')
    .select('subject_id')
    .eq('owner_id', callerId)
    .in('subject_id', frequentUserIds)
    .eq('hide_activity_from', true);
  const hiddenFrom = new Set((hideRows ?? []).map((row) => row.subject_id));

  const recipients = frequentUserIds.filter((id) => !muted.has(id) && !hiddenFrom.has(id));
  if (!recipients.length) return new Response('no eligible recipients', { status: 200 });

  const title = `${host?.name ?? 'Un host'} a creat un Spritz nou!`;

  const pushData = { target_id: eventId };

  await admin.from('notifications').insert(
    recipients.map((recipientId) => ({
      recipient_id: recipientId,
      actor_id: callerId,
      type: 'event_updated',
      title,
      body: event.title,
      data: pushData,
    }))
  );

  const { data: tokens } = await admin.from('push_tokens').select('token').in('user_id', recipients);
  await sendExpoPush((tokens ?? []).map((t) => t.token), title, event.title, pushData);

  return new Response('ok', { status: 200 });
});
