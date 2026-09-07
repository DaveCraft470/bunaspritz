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
  reply_to_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  pinned_at: string | null;
  pinned_by: string | null;
  poll_id: string | null;
};

const GROUP_MESSAGE_COLUMNS =
  'id, event_id, sender_id, text, is_system, created_at, media_path, media_type, media_url, reply_to_id, edited_at, deleted_at, pinned_at, pinned_by, poll_id';

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
  text: string,
  replyToId?: string | null
): Promise<DbGroupMessage | null> {
  if (text.length > 500) return null;
  const { data, error } = await supabase
    .from('event_group_messages')
    .insert({ event_id: eventId, sender_id: senderId, text, reply_to_id: replyToId ?? null })
    .select(GROUP_MESSAGE_COLUMNS)
    .single();

  if (error) return null;
  return data;
}

// ==================================================== edit / delete / pin ==
export async function editGroupMessage(messageId: string, text: string): Promise<DbGroupMessage | null> {
  const { data, error } = await supabase.rpc('edit_group_message', { p_message_id: messageId, p_text: text });
  if (error) return null;
  return data as unknown as DbGroupMessage;
}

export async function deleteGroupMessage(messageId: string): Promise<boolean> {
  const { error } = await supabase.rpc('delete_group_message', { p_message_id: messageId });
  return !error;
}

export async function pinGroupMessage(messageId: string): Promise<boolean> {
  const { error } = await supabase.rpc('pin_group_message', { p_message_id: messageId });
  return !error;
}

export async function unpinGroupMessage(messageId: string): Promise<boolean> {
  const { error } = await supabase.rpc('unpin_group_message', { p_message_id: messageId });
  return !error;
}

export async function getPinnedMessages(eventId: string): Promise<DbGroupMessage[]> {
  const { data, error } = await supabase
    .from('event_group_messages')
    .select(GROUP_MESSAGE_COLUMNS)
    .eq('event_id', eventId)
    .not('pinned_at', 'is', null)
    .order('pinned_at', { ascending: false });
  if (error) return [];
  return data;
}

// ============================================================ reactions ====
export type MessageReaction = { message_id: string; user_id: string; emoji: string };

export async function getReactions(messageIds: string[]): Promise<MessageReaction[]> {
  if (!messageIds.length) return [];
  const { data, error } = await supabase.from('message_reactions').select('message_id, user_id, emoji').in('message_id', messageIds);
  if (error) return [];
  return data;
}

// Toggle: tapping the same emoji you already reacted with removes it,
// tapping a different one swaps it — see react_to_group_message.
export async function reactToMessage(messageId: string, emoji: string): Promise<boolean> {
  const { error } = await supabase.rpc('react_to_group_message', { p_message_id: messageId, p_emoji: emoji });
  return !error;
}

// No column-level filter is possible (message_reactions has no event_id),
// but RLS on the table means a caller only ever receives change events for
// reactions on messages in events they're actually in — see the migration.
export function subscribeToReactions(eventId: string, onChange: () => void) {
  const channel = freshChannel(`message-reactions-${eventId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// ================================================================ reads ====
export async function getGroupLastRead(eventId: string, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('event_group_reads')
    .select('last_read_at')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  return data?.last_read_at ?? null;
}

export async function markGroupRead(eventId: string, userId: string): Promise<void> {
  await supabase
    .from('event_group_reads')
    .upsert({ event_id: eventId, user_id: userId, last_read_at: new Date().toISOString() }, { onConflict: 'event_id,user_id' });
}

// ================================================================ polls ====
export type DbGroupPoll = { id: string; event_id: string; created_by: string; question: string; closed_at: string | null; created_at: string };
export type PollResult = { optionId: string; label: string; position: number; voteCount: number; myVote: boolean };

export async function getPoll(pollId: string): Promise<DbGroupPoll | null> {
  const { data, error } = await supabase
    .from('event_group_polls')
    .select('id, event_id, created_by, question, closed_at, created_at')
    .eq('id', pollId)
    .single();
  if (error) return null;
  return data;
}

export async function createGroupPoll(eventId: string, question: string, options: string[]): Promise<DbGroupMessage | null> {
  const { data, error } = await supabase.rpc('create_group_poll', { p_event_id: eventId, p_question: question, p_options: options });
  if (error) return null;
  return data as unknown as DbGroupMessage;
}

export async function voteGroupPoll(pollId: string, optionId: string): Promise<boolean> {
  const { error } = await supabase.rpc('vote_group_poll', { p_poll_id: pollId, p_option_id: optionId });
  return !error;
}

export async function closeGroupPoll(pollId: string): Promise<boolean> {
  const { error } = await supabase.rpc('close_group_poll', { p_poll_id: pollId });
  return !error;
}

export async function getPollResults(pollId: string): Promise<PollResult[]> {
  const { data, error } = await supabase.rpc('get_poll_results', { p_poll_id: pollId });
  if (error || !data) return [];
  return (data as { option_id: string; label: string; position: number; vote_count: number; my_vote: boolean }[]).map((row) => ({
    optionId: row.option_id,
    label: row.label,
    position: row.position,
    voteCount: row.vote_count,
    myVote: row.my_vote,
  }));
}

export function subscribeToPollVotes(eventId: string, onChange: () => void) {
  const channel = freshChannel(`group-poll-votes-${eventId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_group_poll_votes' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_group_polls' }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// ======================================================== shared media =====
// Independent of whatever's currently loaded in the open thread — used by
// the "Shared Media" gallery, which a user can open without having scrolled
// through the whole history first.
export async function getGroupMedia(eventId: string): Promise<DbGroupMessage[]> {
  const { data, error } = await supabase
    .from('event_group_messages')
    .select(GROUP_MESSAGE_COLUMNS)
    .eq('event_id', eventId)
    .in('media_type', ['image', 'gif'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) return [];
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
