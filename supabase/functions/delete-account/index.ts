import { adminClient, getCallerId } from '../_shared/push.ts';

// A normal client can't delete its own auth.users row directly (no such
// RLS-governed table — auth.users is managed by GoTrue, not exposed to the
// Data API), so this needs the service role. profiles/event_attendees/
// messages/etc. all reference profiles.id with `on delete cascade`, so
// deleting the auth user cleans up everything downstream on its own.
Deno.serve(async (req) => {
  const admin = adminClient();
  const callerId = await getCallerId(req, admin);
  if (!callerId) return new Response('unauthorized', { status: 401 });

  const { error } = await admin.auth.admin.deleteUser(callerId);
  if (error) return new Response(error.message, { status: 500 });

  return new Response('ok', { status: 200 });
});
