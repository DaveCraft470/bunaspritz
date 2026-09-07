import { supabase } from '@/lib/supabase';
import { freshChannel } from '@/lib/realtime';

export type DbGroupMessage = {
  id: string;
  event_id: string;
  sender_id: string;
  text: string;
  is_system: boolean;
  created_at: string;
};

const GROUP_MESSAGE_COLUMNS = 'id, event_id, sender_id, text, is_system, created_at';

export async function getGroupThread(eventId: string): Promise<DbGroupMessage[]> {
  const { data, error } = await supabase
    .from('event_group_messages')
    .select(GROUP_MESSAGE_COLUMNS)
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (error) return [];
  return data;
}

export async function sendEventGroupMessage(
  eventId: string,
  senderId: string,
  text: string
): Promise<DbGroupMessage | null> {
  const { data, error } = await supabase
    .from('event_group_messages')
    .insert({ event_id: eventId, sender_id: senderId, text })
    .select(GROUP_MESSAGE_COLUMNS)
    .single();

  if (error) return null;
  return data;
}

// Group-chat senders are whoever's in the event, not just your mutual
// friends — read straight from profiles (readable by any signed-in user)
// rather than visible_event_attendees, which drops anyone who's hidden
// their activity from you and would otherwise render with a blank name.
export async function getSenderProfiles(senderIds: string[]): Promise<Record<string, { name: string; avatarUrl: string | null }>> {
  const uniqueIds = [...new Set(senderIds)];
  if (uniqueIds.length === 0) return {};

  const { data } = await supabase.from('profiles').select('id, name, avatar_url').in('id', uniqueIds);
  const map: Record<string, { name: string; avatarUrl: string | null }> = {};
  (data ?? []).forEach((p) => {
    map[p.id] = { name: p.name, avatarUrl: p.avatar_url };
  });
  return map;
}

export function subscribeToEventGroupMessages(eventId: string, onMessage: (message: DbGroupMessage) => void) {
  const channel = freshChannel(`event-group-${eventId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'event_group_messages', filter: `event_id=eq.${eventId}` },
      (payload) => onMessage(payload.new as DbGroupMessage)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
