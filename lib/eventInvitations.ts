import { supabase } from '@/lib/supabase';
import { freshChannel } from '@/lib/realtime';

export type EventInviteStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export type EventInvite = {
  id: string;
  eventId: string;
  eventTitle: string;
  senderId: string;
  recipientId: string;
  status: EventInviteStatus;
  createdAt: string;
};

type EventInviteRow = {
  id: string;
  event_id: string;
  sender_id: string;
  recipient_id: string;
  status: EventInviteStatus;
  created_at: string;
  events: { title: string } | null;
};

const INVITE_COLUMNS = 'id, event_id, sender_id, recipient_id, status, created_at, events(title)';

function mapInvite(row: EventInviteRow): EventInvite {
  return {
    id: row.id,
    eventId: row.event_id,
    eventTitle: row.events?.title ?? '',
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function getEventInvite(id: string): Promise<EventInvite | null> {
  const { data, error } = await supabase.from('event_invites').select(INVITE_COLUMNS).eq('id', id).single();
  if (error || !data) return null;
  return mapInvite(data as unknown as EventInviteRow);
}

// Batched, for a chat thread or the notifications screen that may have
// several invite cards visible at once.
export async function getEventInvites(ids: string[]): Promise<EventInvite[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from('event_invites').select(INVITE_COLUMNS).in('id', ids);
  if (error) return [];
  return (data as unknown as EventInviteRow[]).map(mapInvite);
}

// Which of the sender's friends already have an active (pending/accepted)
// invite to this event — used to disable them in the friend picker instead
// of letting a duplicate invite hit send_event_invitation()'s own "already
// invited" check.
export async function getActiveInvitedRecipientIds(eventId: string, senderId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('event_invites')
    .select('recipient_id')
    .eq('event_id', eventId)
    .eq('sender_id', senderId)
    .in('status', ['pending', 'accepted']);
  if (error) return new Set();
  return new Set(data.map((row) => row.recipient_id as string));
}

export type SendInvitationResult = { ok: true } | { ok: false; error: string };

// send_event_invitation() inserts the event_invites row and the DM message
// pointing at it atomically — the invite literally lives in the recipient's
// chat thread from the moment this returns, no separate "post a message"
// step needed. Best-effort push notify after, same idiom as every other
// notify-* call site (lib/events.ts's requestToJoinEvent etc).
export async function sendEventInvitation(eventId: string, recipientId: string): Promise<SendInvitationResult> {
  const { data, error } = await supabase.rpc('send_event_invitation', { p_event_id: eventId, p_recipient_id: recipientId });
  if (error) {
    if (error.message.includes('already invited')) return { ok: false, error: 'Acest prieten a fost deja invitat.' };
    return { ok: false, error: 'Nu am putut trimite invitația.' };
  }

  const invitationId = (data as { event_invite_id?: string } | null)?.event_invite_id;
  if (invitationId) {
    supabase.functions.invoke('notify-event-invite', { body: { invitationId } }).catch(() => {});
  }
  return { ok: true };
}

// Callable from either surface (the chat card or the notifications screen)
// — both read the same event_invites row live, so accepting/declining from
// one shows as resolved on the other via subscribeToEventInvites below.
export async function respondEventInvitation(invitationId: string, accept: boolean): Promise<boolean> {
  const { error } = await supabase.rpc('respond_event_invitation', { p_invitation_id: invitationId, p_accept: accept });
  if (error) return false;

  supabase.functions.invoke('notify-event-invite-response', { body: { invitationId } }).catch(() => {});
  return true;
}

// Two channels (Realtime filters can't express an OR across columns) since
// a user can be on either side of an invite — sent ones and received ones.
// The caller just refetches whatever invite ids it currently has loaded
// rather than trying to patch a single row from the raw payload, same idiom
// as subscribeToPollVotes.
export function subscribeToEventInvites(userId: string, onChange: () => void) {
  const recipientChannel = freshChannel(`event-invites-recipient-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_invites', filter: `recipient_id=eq.${userId}` }, onChange)
    .subscribe();
  const senderChannel = freshChannel(`event-invites-sender-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_invites', filter: `sender_id=eq.${userId}` }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(recipientChannel);
    supabase.removeChannel(senderChannel);
  };
}
