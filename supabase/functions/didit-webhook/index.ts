import { adminClient } from '../_shared/push.ts';

// Public endpoint — Didit calls this directly, with no Supabase JWT, so this
// function is deployed with verify_jwt off (see supabase/config.toml). The
// HMAC signature below is what stands in for auth here.
const MAX_CLOCK_SKEW_SECONDS = 300;

async function hmacSha256Hex(secret: string, message: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, message);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('DIDIT_WEBHOOK_SECRET')!;
  const signatureHeader = req.headers.get('X-Signature');
  const timestampHeader = req.headers.get('X-Timestamp');

  if (!signatureHeader || !timestampHeader) {
    return new Response('missing signature headers', { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestampHeader, 10)) > MAX_CLOCK_SKEW_SECONDS) {
    return new Response('stale timestamp', { status: 400 });
  }

  // Verified over the exact raw bytes received (Didit's "X-Signature" raw-bytes
  // fallback) rather than X-Signature-V2's re-serialized canonical JSON —
  // re-implementing their canonicalization (recursive key sort, float
  // formatting, etc.) byte-for-byte is easy to get subtly wrong, and a subtle
  // bug in a signature check is worse than not having the "recommended" one.
  const rawBody = new Uint8Array(await req.arrayBuffer());
  const expected = await hmacSha256Hex(secret, rawBody);

  if (!timingSafeEqual(expected, signatureHeader)) {
    return new Response('invalid signature', { status: 401 });
  }

  const payload = JSON.parse(new TextDecoder().decode(rawBody));

  if (payload.webhook_type === 'status.updated' && payload.vendor_data) {
    if (payload.status === 'Approved') {
      const admin = adminClient();
      await admin.from('profiles').update({ verified: true }).eq('id', payload.vendor_data);
    } else {
      // Declined/Rejected/Expired etc. — no profiles column to record this
      // yet, so nothing to write, but log it rather than dropping it
      // silently: verification.tsx's own timeout is what actually gets a
      // rejected user unstuck client-side (it can't distinguish "still
      // processing" from "rejected" without a status field to poll).
      console.log(`Didit verification not approved for ${payload.vendor_data}: ${payload.status}`);
    }
  }

  return new Response('ok', { status: 200 });
});
