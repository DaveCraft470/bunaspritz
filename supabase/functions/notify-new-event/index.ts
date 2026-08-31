import { adminClient, getCallerId, sendExpoPush } from '../_shared/push.ts';

// "Attends often" = has attended at least this many of the host's OTHER events.
const FREQUENT_ATTENDEE_THRESHOLD = 2;

Deno.serve(async (req) => {
  const admin = adminClient();
  const callerId = await getCallerId(req, admin);
  if (!callerId) return new Response('unauthorized', { status: 401 });

  const { eventId } = await req.json();

  const { data: event } = await admin.from('events').select('id, title, host_id').eq('id', eventId).single();
  if (!event || event.host_id !== callerId) return new Response('forbidden', { status: 403 });

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

  const frequentUserIds = [...attendedEventsByUser.entries()]
    .filter(([, events]) => events.size >= FREQUENT_ATTENDEE_THRESHOLD)
    .map(([userId]) => userId);

  if (!frequentUserIds.length) return new Response('no frequent attendees yet', { status: 200 });

  const { data: muteRows } = await admin
    .from('friend_prefs')
    .select('owner_id')
    .in('owner_id', frequentUserIds)
    .eq('subject_id', callerId)
    .eq('mute_activity', true);
  const muted = new Set((muteRows ?? []).map((row) => row.owner_id));

  const recipients = frequentUserIds.filter((id) => !muted.has(id));
  if (!recipients.length) return new Response('no eligible recipients', { status: 200 });

  const { data: tokens } = await admin.from('push_tokens').select('token').in('user_id', recipients);

  await sendExpoPush(
    (tokens ?? []).map((t) => t.token),
    `${host?.name ?? 'Un host'} a creat un Spritz nou!`,
    event.title
  );

  return new Response('ok', { status: 200 });
});
