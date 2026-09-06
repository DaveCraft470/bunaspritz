import { adminClient, getCallerId, sendExpoPush } from '../_shared/push.ts';

Deno.serve(async (req) => {
  const admin = adminClient();
  const callerId = await getCallerId(req, admin);
  if (!callerId) return new Response('unauthorized', { status: 401 });

  const { requestId } = await req.json();

  const { data: request } = await admin
    .from('event_join_requests')
    .select('id, user_id, status, event_id, events!inner(id, title, host_id)')
    .eq('id', requestId)
    .single();

  // Only the host who just responded (via respond_join_request) can trigger
  // this, and only after the status has actually moved off "pending".
  if (!request || request.events.host_id !== callerId || request.status === 'pending') {
    return new Response('forbidden', { status: 403 });
  }

  const { data: tokens } = await admin.from('push_tokens').select('token').eq('user_id', request.user_id);
  if (!tokens?.length) return new Response('requester has no push tokens', { status: 200 });

  const accepted = request.status === 'accepted';

  await sendExpoPush(
    tokens.map((t) => t.token),
    accepted ? 'Cerere acceptată!' : 'Cerere respinsă',
    accepted
      ? `Ai fost acceptat la ${request.events.title}.`
      : `Cererea ta pentru ${request.events.title} a fost respinsă.`,
    { route: `/event/${request.events.id}` }
  );

  return new Response('ok', { status: 200 });
});
