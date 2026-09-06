import { adminClient, getCallerId, sendExpoPush } from '../_shared/push.ts';

Deno.serve(async (req) => {
  const admin = adminClient();
  const callerId = await getCallerId(req, admin);
  if (!callerId) return new Response('unauthorized', { status: 401 });

  const { eventId } = await req.json();

  // Confirm the caller actually has a pending request on this event — don't
  // trust the body alone (same idiom as notify-join's attendance check).
  const { data: request } = await admin
    .from('event_join_requests')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', callerId)
    .eq('status', 'pending')
    .maybeSingle();

  if (!request) return new Response('forbidden', { status: 403 });

  const { data: event } = await admin.from('events').select('id, title, host_id').eq('id', eventId).single();
  if (!event) return new Response('event not found', { status: 404 });

  const { data: requester } = await admin.from('profiles').select('name').eq('id', callerId).single();
  const { data: tokens } = await admin.from('push_tokens').select('token').eq('user_id', event.host_id);

  await sendExpoPush(
    (tokens ?? []).map((t) => t.token),
    'Cerere de participare',
    `${requester?.name ?? 'Cineva'} vrea să participe la ${event.title}.`,
    { route: `/organizer-participants/${event.id}` }
  );

  return new Response('ok', { status: 200 });
});
