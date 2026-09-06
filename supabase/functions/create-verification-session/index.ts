import { adminClient, getCallerId } from '../_shared/push.ts';

// Starts a Didit KYC session for the calling user and hands back the hosted
// verification URL. vendor_data is set to the JWT-verified caller id (never
// something the client supplies), which is how didit-webhook later knows
// which profile to mark verified.
Deno.serve(async (req) => {
  const admin = adminClient();
  const callerId = await getCallerId(req, admin);
  if (!callerId) return new Response('unauthorized', { status: 401 });

  const apiKey = Deno.env.get('DIDIT_API_KEY')!;
  const workflowId = Deno.env.get('DIDIT_WORKFLOW_ID')!;

  const resp = await fetch('https://verification.didit.me/v3/session/', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ workflow_id: workflowId, vendor_data: callerId }),
  });

  if (!resp.ok) {
    console.error('Didit session creation failed', resp.status, await resp.text());
    return new Response('verification provider error', { status: 502 });
  }

  const session = await resp.json();
  return new Response(JSON.stringify({ url: session.url, session_id: session.session_id }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
