import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SB_SECRET_KEY')!);
}

// Verifies the caller's JWT (from the Authorization header supabase.functions.invoke
// sends automatically) and returns their user id, or null if it's missing/invalid.
// Using the admin client's auth.getUser(jwt) just validates the token's signature —
// it does not grant the caller admin rights.
export async function getCallerId(req: Request, admin: SupabaseClient): Promise<string | null> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace('Bearer ', '');
  if (!jwt) return null;

  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return null;
  return data.user.id;
}

export async function sendExpoPush(tokens: string[], title: string, body: string) {
  if (!tokens.length) return;

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tokens.map((to) => ({ to, title, body, sound: 'default' }))),
  });
}
