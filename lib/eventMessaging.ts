import { supabase } from '@/lib/supabase';
import { freshChannel } from '@/lib/realtime';

const MEDIA_BUCKET = 'message-media';

export type GroupMediaType = 'image' | 'gif';

export type DbGroupMessage = {
  id: string;
  event_id: string;
  sender_id: string;
  text: string;
  is_system: boolean;
  created_at: string;
  media_path: string | null;
  media_type: GroupMediaType | null;
  media_url: string | null;
};

const GROUP_MESSAGE_COLUMNS = 'id, event_id, sender_id, text, is_system, created_at, media_path, media_type, media_url';

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
  if (text.length > 500) return null;
  const { data, error } = await supabase
    .from('event_group_messages')
    .insert({ event_id: eventId, sender_id: senderId, text })
    .select(GROUP_MESSAGE_COLUMNS)
    .single();

  if (error) return null;
  return data;
}

// Group photos reuse the message-media bucket, uploaded under the sender's
// own folder (same "upload your own message media" storage policy as DMs)
// but with their own read policy since they never appear in the messages
// table (see the add_chat_media_and_view_once migration).
export async function sendEventGroupImageMessage(
  eventId: string,
  senderId: string,
  localUri: string,
  extension: string,
  contentType: string
): Promise<DbGroupMessage | null> {
  const bytes = await (await fetch(localUri)).arrayBuffer();
  if (bytes.byteLength === 0) return null;

  const path = `${senderId}/${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`;
  const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType });
  if (uploadError) return null;

  const { data, error } = await supabase
    .from('event_group_messages')
    .insert({ event_id: eventId, sender_id: senderId, text: '', media_path: path, media_type: 'image' })
    .select(GROUP_MESSAGE_COLUMNS)
    .single();

  if (error) {
    await supabase.storage.from(MEDIA_BUCKET).remove([path]);
    return null;
  }
  return data;
}

export async function sendEventGroupGifMessage(eventId: string, senderId: string, gifUrl: string): Promise<DbGroupMessage | null> {
  const { data, error } = await supabase
    .from('event_group_messages')
    .insert({ event_id: eventId, sender_id: senderId, text: '', media_url: gifUrl, media_type: 'gif' })
    .select(GROUP_MESSAGE_COLUMNS)
    .single();

  if (error) return null;
  return data;
}

// Group photos live in the same message-media bucket as DM photos — reuse
// lib/messaging's getSignedMediaUrl rather than duplicating the signing call.

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
