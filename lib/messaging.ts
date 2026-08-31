import { supabase } from '@/lib/supabase';

export type DbMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  text: string;
  created_at: string;
};

function threadFilter(myId: string, friendId: string) {
  return `and(sender_id.eq.${myId},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${myId})`;
}

export async function getThread(myId: string, friendId: string): Promise<DbMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, recipient_id, text, created_at')
    .or(threadFilter(myId, friendId))
    .order('created_at', { ascending: true });

  if (error) return [];
  return data;
}

export async function getLastMessage(myId: string, friendId: string): Promise<DbMessage | null> {
  const { data } = await supabase
    .from('messages')
    .select('id, sender_id, recipient_id, text, created_at')
    .or(threadFilter(myId, friendId))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

export async function sendDirectMessage(myId: string, friendId: string, text: string): Promise<DbMessage | null> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: myId, recipient_id: friendId, text })
    .select('id, sender_id, recipient_id, text, created_at')
    .single();

  if (error) return null;
  return data;
}

// Global-to-your-inbox subscription (Realtime filters can't express the
// "either side of this pair" OR condition), filtered to messages you
// received; the caller checks payload.sender_id against whichever thread
// (if any) is currently open.
export function subscribeToIncoming(myId: string, onMessage: (message: DbMessage) => void) {
  const channel = supabase
    .channel(`messages-recipient-${myId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${myId}` },
      (payload) => onMessage(payload.new as DbMessage)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
