import { adminClient, getCallerId, sendExpoPush } from '../_shared/push.ts';

Deno.serve(async (req) => {
  const admin = adminClient();
  const callerId = await getCallerId(req, admin);
  if (!callerId) return new Response('unauthorized', { status: 401 });

  const { invitationId } = await req.json();

  // Confirm the caller actually sent this invite — don't trust the body alone.
  const { data: invite } = await admin
    .from('event_invites')
    .select('id, recipient_id, sender_id, events!inner(id, title)')
    .eq('id', invitationId)
    .eq('sender_id', callerId)
    .maybeSingle();

  if (!invite) return new Response('forbidden', { status: 403 });

  const { data: sender } = await admin.from('profiles').select('name').eq('id', callerId).single();

  const title = 'Invitație la eveniment';
  const body = `${sender?.name ?? 'Cineva'} te-a invitat la ${invite.events.title}.`;
  const pushData = { target_id: invite.events.id, invitation_id: invite.id };

  await admin.from('notifications').insert({
    recipient_id: invite.recipient_id,
    actor_id: callerId,
    type: 'event_invite',
    title,
    body,
    data: pushData,
  });

  const { data: tokens } = await admin.from('push_tokens').select('token').eq('user_id', invite.recipient_id);
  await sendExpoPush((tokens ?? []).map((t) => t.token), title, body, pushData);

  return new Response('ok', { status: 200 });
});
