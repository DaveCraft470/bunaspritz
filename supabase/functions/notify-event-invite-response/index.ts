import { adminClient, getCallerId, sendExpoPush } from '../_shared/push.ts';

Deno.serve(async (req) => {
  const admin = adminClient();
  const callerId = await getCallerId(req, admin);
  if (!callerId) return new Response('unauthorized', { status: 401 });

  const { invitationId } = await req.json();

  const { data: invite } = await admin
    .from('event_invites')
    .select('id, sender_id, recipient_id, status, events!inner(id, title)')
    .eq('id', invitationId)
    .single();

  // Only the recipient who just responded (via respond_event_invitation) can
  // trigger this, and only after the status has actually moved off "pending".
  if (!invite || invite.recipient_id !== callerId || invite.status === 'pending') {
    return new Response('forbidden', { status: 403 });
  }

  const accepted = invite.status === 'accepted';
  const { data: recipient } = await admin.from('profiles').select('name').eq('id', callerId).single();

  const title = accepted ? 'Invitație acceptată' : 'Invitație refuzată';
  const body = accepted
    ? `${recipient?.name ?? 'Cineva'} a acceptat invitația la ${invite.events.title}.`
    : `${recipient?.name ?? 'Cineva'} a refuzat invitația la ${invite.events.title}.`;
  const pushData = { target_id: invite.events.id, invitation_id: invite.id };

  await admin.from('notifications').insert({
    recipient_id: invite.sender_id,
    actor_id: callerId,
    type: 'event_invite',
    title,
    body,
    data: pushData,
  });

  const { data: tokens } = await admin.from('push_tokens').select('token').eq('user_id', invite.sender_id);
  await sendExpoPush((tokens ?? []).map((t) => t.token), title, body, pushData);

  return new Response('ok', { status: 200 });
});
