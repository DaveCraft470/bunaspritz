import { createNotification, getNotifications, updateNotification } from '@/lib/notifications';
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

type Listener = () => void;
type Result = { ok: true; invitation: EventInvitation } | { ok: false; error: string };

const invitations: EventInvitation[] = [];
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeToEventInvitations(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getEventInvitation(invitationId: string) {
  return invitations.find((invitation) => invitation.id === invitationId) ?? null;
}

export function getEventInvitationForPair(eventId: string, senderId: string, recipientId: string) {
  return (
    [...invitations].reverse().find(
      (invitation) =>
        invitation.eventId === eventId &&
        invitation.senderId === senderId &&
        invitation.recipientId === recipientId &&
        invitation.status !== 'cancelled',
    ) ?? null
  );
}

export function getEventInvitationsForRecipient(recipientId: string) {
  return invitations.filter((invitation) => invitation.recipientId === recipientId);
}

export function sendEventInvitation(
  event: SpritzEvent,
  senderId: string,
  recipientId: string,
  senderName: string,
): Result {
  if (!event.id || !senderId || !recipientId || senderId === recipientId) {
    return { ok: false, error: 'Invitația nu are un destinatar valid.' };
  }

  const existing = getEventInvitationForPair(event.id, senderId, recipientId);
  if (existing && (existing.status === 'pending' || existing.status === 'accepted')) {
    return { ok: false, error: 'Acest prieten a fost deja invitat.' };
  }

  const invitation: EventInvitation = {
    id: `event-invitation-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    eventId: event.id,
    senderId,
    recipientId,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  invitations.push(invitation);
  emit();

  createNotification({
    type: 'event_invite',
    actorId: senderId,
    recipientId,
    targetId: event.id,
    title: 'Invitație la eveniment',
    body: `${senderName} te-a invitat la ${event.title}.`,
    metadata: { eventTitle: event.title, invitationId: invitation.id, invitationStatus: 'pending' },
  });

  return { ok: true, invitation };
}

export function acceptEventInvitation(recipientId: string, invitationId: string): Result {
  const invitation = invitations.find(
    (item) => item.id === invitationId && item.recipientId === recipientId && item.status === 'pending',
  );
  if (!invitation) return { ok: false, error: 'Invitația nu mai este disponibilă.' };

  invitation.status = 'accepted';
  emit();
  updateNotificationForInvitation(invitation, 'accepted');
  return { ok: true, invitation };
}

export function declineEventInvitation(recipientId: string, invitationId: string): Result {
  const invitation = invitations.find(
    (item) => item.id === invitationId && item.recipientId === recipientId && item.status === 'pending',
  );
  if (!invitation) return { ok: false, error: 'Invitația nu mai este disponibilă.' };

  invitation.status = 'declined';
  emit();
  updateNotificationForInvitation(invitation, 'declined');
  return { ok: true, invitation };
}

function updateNotificationForInvitation(invitation: EventInvitation, status: 'accepted' | 'declined') {
  const notification = getNotifications(invitation.recipientId).find(
    (item) => item.type === 'event_invite' && item.metadata?.invitationId === invitation.id,
  );
  if (!notification) return;
  updateNotification(notification.id, {
    body: status === 'accepted' ? 'Ai acceptat invitația. Deschide evenimentul ca să confirmi participarea.' : 'Ai refuzat această invitație.',
    readAt: new Date().toISOString(),
    metadata: { ...notification.metadata, invitationStatus: status },
  });
}

export function simulateEventInvitation(recipientId: string, event: SpritzEvent, senderId: string, senderName: string) {
  return sendEventInvitation(event, senderId, recipientId, senderName);
}
