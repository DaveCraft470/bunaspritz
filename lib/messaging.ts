import { supabase } from '@/lib/supabase';

export type DbMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  text: string;
  created_at: string;
  read_at: string | null;
};

function threadFilter(myId: string, friendId: string) {
  return `and(sender_id.eq.${myId},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${myId})`;
}

export async function getThread(myId: string, friendId: string): Promise<DbMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, recipient_id, text, created_at, read_at')
    .or(threadFilter(myId, friendId))
    .order('created_at', { ascending: true });

  if (error) return [];
  return data;
}

export async function getLastMessage(myId: string, friendId: string): Promise<DbMessage | null> {
  const { data } = await supabase
    .from('messages')
    .select('id, sender_id, recipient_id, text, created_at, read_at')
    .or(threadFilter(myId, friendId))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

export async function getUnreadCount(myId: string, friendId: string): Promise<number> {
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('sender_id', friendId)
    .eq('recipient_id', myId)
    .is('read_at', null);

  return count ?? 0;
}

// Called when a friend's thread is opened — clears their unread badge by
// marking every message they sent you (that isn't already read) as read,
// and flips your own sent messages to double-check once they read theirs.
export async function markThreadRead(myId: string, friendId: string): Promise<void> {
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('sender_id', friendId)
    .eq('recipient_id', myId)
    .is('read_at', null);
}

export async function sendDirectMessage(myId: string, friendId: string, text: string): Promise<DbMessage | null> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: myId, recipient_id: friendId, text })
    .select('id, sender_id, recipient_id, text, created_at, read_at')
    .single();

  if (error) return null;

  // Best-effort — a failed push shouldn't undo an already-sent message.
  supabase.functions.invoke('notify-message', { body: { messageId: data.id } }).catch(() => {});

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

// Notifies the sender when a friend marks one of their messages read, so the
// single-check tick can flip to a double-check live instead of only on the
// next time the thread list happens to reload.
export function subscribeToReadReceipts(myId: string, onRead: (message: DbMessage) => void) {
  const channel = supabase
    .channel(`messages-sender-${myId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender_id=eq.${myId}` },
      (payload) => onRead(payload.new as DbMessage)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
