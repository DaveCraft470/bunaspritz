import { adminClient, getCallerId, sendExpoPush } from '../_shared/push.ts';

Deno.serve(async (req) => {
  const admin = adminClient();
  const callerId = await getCallerId(req, admin);
  if (!callerId) return new Response('unauthorized', { status: 401 });

  const { followeeId } = await req.json();

  // Confirm the caller actually followed this person — don't trust the body alone.
  const { data: edge } = await admin
    .from('follows')
    .select('follower_id')
    .eq('follower_id', callerId)
    .eq('followee_id', followeeId)
    .maybeSingle();

  if (!edge) return new Response('forbidden', { status: 403 });

  // The followee (owner) can mute the follower's activity — following is the
  // follower's activity, so this is the same switch that silences it elsewhere.
  const { data: prefs } = await admin
    .from('friend_prefs')
    .select('mute_activity')
    .eq('owner_id', followeeId)
    .eq('subject_id', callerId)
    .maybeSingle();

  if (prefs?.mute_activity) {
    return new Response('followee muted this follower', { status: 200 });
  }

  const { data: follower } = await admin.from('profiles').select('name').eq('id', callerId).single();
  const { data: tokens } = await admin.from('push_tokens').select('token').eq('user_id', followeeId);

  await sendExpoPush(
    (tokens ?? []).map((t) => t.token),
    'Prieten nou!',
    `${follower?.name ?? 'Cineva'} te-a adăugat ca prieten.`
  );

  return new Response('ok', { status: 200 });
});
