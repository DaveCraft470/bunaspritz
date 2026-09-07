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

  const accepted = request.status === 'accepted';
  const title = accepted ? 'Cerere acceptată!' : 'Cerere respinsă';
  const body = accepted
    ? `Ai fost acceptat la ${request.events.title}.`
    : `Cererea ta pentru ${request.events.title} a fost respinsă.`;

  // No dedicated notification type for this yet (see the `notifications`
  // table's type check) — 'system' is the closest fit without touching a
  // constraint another job's migration currently owns.
  const pushData = { target_id: request.events.id };

  await admin.from('notifications').insert({
    recipient_id: request.user_id,
    actor_id: callerId,
    type: 'system',
    title,
    body,
    data: pushData,
  });

  const { data: tokens } = await admin.from('push_tokens').select('token').eq('user_id', request.user_id);
  await sendExpoPush((tokens ?? []).map((t) => t.token), title, body, pushData);

  return new Response('ok', { status: 200 });
});
