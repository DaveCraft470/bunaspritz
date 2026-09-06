import { adminClient, getCallerId, sendExpoPush } from '../_shared/push.ts';

Deno.serve(async (req) => {
  const admin = adminClient();
  const callerId = await getCallerId(req, admin);
  if (!callerId) return new Response('unauthorized', { status: 401 });

  const { messageId } = await req.json();

  const { data: message } = await admin
    .from('messages')
    .select('id, sender_id, recipient_id, text, media_type')
    .eq('id', messageId)
    .single();

  if (!message || message.sender_id !== callerId) {
    return new Response('forbidden', { status: 403 });
  }

  const { data: prefs } = await admin
    .from('friend_prefs')
    .select('mute_messages')
    .eq('owner_id', message.recipient_id)
    .eq('subject_id', message.sender_id)
    .maybeSingle();

  if (prefs?.mute_messages) {
    return new Response('recipient muted this sender', { status: 200 });
  }

  const { data: sender } = await admin.from('profiles').select('name').eq('id', message.sender_id).single();
  const { data: tokens } = await admin.from('push_tokens').select('token').eq('user_id', message.recipient_id);

  const body =
    message.media_type === 'image' ? '📷 Poză' : message.media_type === 'audio' ? '🎤 Mesaj vocal' : message.text;

  await sendExpoPush(
    (tokens ?? []).map((t) => t.token),
    `Mesaj nou de la ${sender?.name ?? 'un prieten'}`,
    body
  );

  return new Response('ok', { status: 200 });
});
