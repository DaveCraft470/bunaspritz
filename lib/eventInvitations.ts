import { supabase } from '@/lib/supabase';
import type { SpritzEvent } from '@/constants/events';

export type EventInvitationStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export type EventInvitation = {
  id: string;
  eventId: string;
  senderId: string;
  recipientId: string;
  createdAt: string;
  status: EventInvitationStatus;
};

type Result = { ok: true; invitation: EventInvitation } | { ok: false; error: string };

const GENERIC_ERROR = 'A apărut o eroare. Încearcă din nou.';

function fromRow(row: any): EventInvitation {
  return { id: row.id, eventId: row.event_id, senderId: row.sender_id, recipientId: row.recipient_id, createdAt: row.created_at, status: row.status };
}

function mapError(error: any): string {
  const message: string = error?.message ?? '';
  if (message.includes('can only invite friends')) return 'Poți invita doar prieteni.';
  if (message.includes('blocked')) return 'Nu poți invita această persoană.';
  if (message.includes('only the host or an attendee')) return 'Doar hostul sau un participant poate invita.';
  if (message.includes('already attending')) return 'Acest prieten a fost deja invitat.';
  if (message.includes('cannot invite yourself')) return 'Nu te poți invita pe tine.';
  if (message.includes('event is full')) return 'Evenimentul este plin.';
  if (message.includes('no pending invitation')) return 'Invitația nu mai este disponibilă.';
  return GENERIC_ERROR;
}

// A local cache is kept (rather than fetching per-render) so
// getEventInvitation()/getEventInvitationForPair() below can stay
// synchronous — app/notifications.tsx reads these inline during render.
// Populated by getEventInvitationsForRecipient()/send/accept/decline, kept
// fresh after that by the realtime subscription.
let cache: EventInvitation[] = [];
const listeners = new Set<() => void>();

// Dev-tools-only overlay (app/notifications.tsx's "Invitație la eveniment"
// button) — the real send_event_invitation() RPC always uses the caller's
// own auth.uid() as sender, so it can't fake "a nonexistent test peer
// invited me." Kept purely local instead, same pattern as
// lib/friendRequests.ts's dev overlay.
const devInvitations: EventInvitation[] = [];

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function mergeIntoCache(rows: EventInvitation[]) {
  const byId = new Map(cache.map((invitation) => [invitation.id, invitation]));
  rows.forEach((invitation) => byId.set(invitation.id, invitation));
  cache = [...byId.values()];
}

export function subscribeToEventInvitations(listener: () => void) {
  listeners.add(listener);
  const channel = supabase
    .channel('event-invitations-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_invitations' }, (payload) => {
      if (payload.eventType === 'DELETE') {
        cache = cache.filter((invitation) => invitation.id !== (payload.old as { id: string }).id);
      } else {
        mergeIntoCache([fromRow(payload.new)]);
      }
      listener();
    })
    .subscribe();
  return () => {
    listeners.delete(listener);
    supabase.removeChannel(channel);
  };
}

export function getEventInvitation(invitationId: string): EventInvitation | null {
  return devInvitations.find((invitation) => invitation.id === invitationId) ?? cache.find((invitation) => invitation.id === invitationId) ?? null;
}

export function getEventInvitationForPair(eventId: string, senderId: string, recipientId: string): EventInvitation | null {
  const all = [...cache, ...devInvitations];
  return (
    all
      .reverse()
      .find(
        (invitation) =>
          invitation.eventId === eventId &&
          invitation.senderId === senderId &&
          invitation.recipientId === recipientId &&
          invitation.status !== 'cancelled'
      ) ?? null
  );
}

export function getEventInvitationsForRecipient(recipientId: string): EventInvitation[] {
  supabase
    .from('event_invitations')
    .select('*')
    .eq('recipient_id', recipientId)
    .then(({ data }) => {
      if (!data) return;
      mergeIntoCache(data.map(fromRow));
      notifyListeners();
    });
  const dev = devInvitations.filter((invitation) => invitation.recipientId === recipientId);
  return [...dev, ...cache.filter((invitation) => invitation.recipientId === recipientId)];
}

export async function sendEventInvitation(event: SpritzEvent, senderId: string, recipientId: string, _senderName: string): Promise<Result> {
  if (!event.id || senderId === recipientId) {
    return { ok: false, error: 'Invitația nu are un destinatar valid.' };
  }

  const { data, error } = await supabase.rpc('send_event_invitation', { p_event_id: event.id, p_recipient_id: recipientId });
  if (error || !data) return { ok: false, error: mapError(error) };

  const invitation = fromRow(data);
  mergeIntoCache([invitation]);
  notifyListeners();
  return { ok: true, invitation };
}

export async function acceptEventInvitation(recipientId: string, invitationId: string): Promise<Result> {
  const dev = devInvitations.find((invitation) => invitation.id === invitationId && invitation.recipientId === recipientId && invitation.status === 'pending');
  if (dev) {
    dev.status = 'accepted';
    notifyListeners();
    return { ok: true, invitation: dev };
  }

  const { data, error } = await supabase.rpc('accept_event_invitation', { p_invitation_id: invitationId });
  if (error || !data) return { ok: false, error: mapError(error) };

  const invitation = fromRow(data);
  mergeIntoCache([invitation]);
  notifyListeners();
  return { ok: true, invitation };
}

export async function declineEventInvitation(recipientId: string, invitationId: string): Promise<Result> {
  const dev = devInvitations.find((invitation) => invitation.id === invitationId && invitation.recipientId === recipientId && invitation.status === 'pending');
  if (dev) {
    dev.status = 'declined';
    notifyListeners();
    return { ok: true, invitation: dev };
  }

  const { data, error } = await supabase.rpc('decline_event_invitation', { p_invitation_id: invitationId });
  if (error || !data) return { ok: false, error: mapError(error) };

  const invitation = fromRow(data);
  mergeIntoCache([invitation]);
  notifyListeners();
  return { ok: true, invitation };
}

export async function cancelEventInvitation(invitationId: string): Promise<Result> {
  const { data, error } = await supabase.rpc('cancel_event_invitation', { p_invitation_id: invitationId });
  if (error || !data) return { ok: false, error: mapError(error) };

  const invitation = fromRow(data);
  mergeIntoCache([invitation]);
  notifyListeners();
  return { ok: true, invitation };
}

// Dev-tools only (app/notifications.tsx) — purely local, never reaches
// Supabase (the real RPC always uses the caller's own auth.uid() as
// sender, so it can't fake an invite "from" a nonexistent test peer).
export function simulateEventInvitation(recipientId: string, event: SpritzEvent, senderId: string, _senderName: string): Result {
  const existing = getEventInvitationForPair(event.id, senderId, recipientId);
  if (existing && (existing.status === 'pending' || existing.status === 'accepted')) {
    return { ok: false, error: 'Acest prieten a fost deja invitat.' };
  }

  const invitation: EventInvitation = {
    id: `dev-invitation-${Date.now()}`,
    eventId: event.id,
    senderId,
    recipientId,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  devInvitations.push(invitation);
  notifyListeners();
  return { ok: true, invitation };
}
