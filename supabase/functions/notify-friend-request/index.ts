import { adminClient, getCallerId, sendExpoPush } from '../_shared/push.ts';

// Replaces notify-follow now that "follow" no longer exists — send_friend_request()
// covers both a fresh pending request and an auto-accept of the other
// person's existing request, so this always notifies the *other* party
// (receiverId), just with different copy depending on which happened.
Deno.serve(async (req) => {
  const admin = adminClient();
  const callerId = await getCallerId(req, admin);
  if (!callerId) return new Response('unauthorized', { status: 401 });

  const { receiverId } = await req.json();

  // Confirm a request actually connects these two — don't trust the body alone.
  const { data: request } = await admin
    .from('friend_requests')
    .select('sender_id, receiver_id, status')
    .or(`and(sender_id.eq.${callerId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${callerId})`)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!request || (request.status !== 'pending' && request.status !== 'accepted')) {
    return new Response('forbidden', { status: 403 });
  }

  const { data: prefs } = await admin
    .from('friend_prefs')
    .select('mute_activity')
    .eq('owner_id', receiverId)
    .eq('subject_id', callerId)
    .maybeSingle();

  const { data: caller } = await admin.from('profiles').select('name').eq('id', callerId).single();
  const callerName = caller?.name || 'Cineva';

  const accepted = request.status === 'accepted';
  const title = accepted ? 'Cerere acceptată!' : 'Cerere de prietenie';
  const body = accepted
    ? `${callerName} a acceptat cererea ta de prietenie.`
    : `${callerName} vrea să fie prieteni.`;

  if (prefs?.mute_activity) {
    return new Response('receiver muted this sender', { status: 200 });
  }

  await admin.from('notifications').insert({
    recipient_id: receiverId,
    actor_id: callerId,
    type: accepted ? 'friend_request_accepted' : 'friend_request',
    title,
    body,
    data: { target_id: callerId },
  });

  const { data: tokens } = await admin.from('push_tokens').select('token').eq('user_id', receiverId);
  await sendExpoPush((tokens ?? []).map((t) => t.token), title, body);

  return new Response('ok', { status: 200 });
});
