import { supabase } from '@/lib/supabase';
import { freshChannel } from '@/lib/realtime';

export type NotificationType =
  | 'friend_request'
  | 'friend_request_accepted'
  | 'event_invite'
  | 'event_join'
  | 'event_updated'
  | 'event_cancelled'
  | 'message'
  | 'review'
  | 'system';

export type Notification = {
  id: string;
  type: NotificationType;
  actorId: string;
  recipientId: string;
  targetId: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  metadata?: Record<string, string>;
};

type Listener = () => void;

const notifications: Notification[] = [];
const listeners = new Set<Listener>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function subscribeToNotifications(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getNotifications(recipientId: string): Notification[] {
  return notifications
    .filter((notification) => notification.recipientId === recipientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getNotificationById(notificationId: string): Notification | null {
  return notifications.find((notification) => notification.id === notificationId) ?? null;
}

export function getUnreadNotificationCount(recipientId: string): number {
  return notifications.filter((notification) => notification.recipientId === recipientId && !notification.readAt).length;
}

export function createNotification(input: Omit<Notification, 'id' | 'createdAt' | 'readAt'>): Notification {
  const duplicate = notifications.find(
    (notification) =>
      notification.type === input.type &&
      notification.actorId === input.actorId &&
      notification.recipientId === input.recipientId &&
      notification.targetId === input.targetId &&
      notification.metadata?.invitationId === input.metadata?.invitationId,
  );
  if (duplicate) return duplicate;

  const notification: Notification = {
    ...input,
    id: `notification-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
    readAt: null,
  };
  notifications.push(notification);
  notifyListeners();
  return notification;
}

export function markNotificationRead(recipientId: string, notificationId: string) {
  const notification = notifications.find((item) => item.id === notificationId && item.recipientId === recipientId);
  if (!notification || notification.readAt) return;
  notification.readAt = new Date().toISOString();
  notifyListeners();
}

export function markAllNotificationsRead(recipientId: string) {
  const now = new Date().toISOString();
  let changed = false;
  notifications.forEach((notification) => {
    if (notification.recipientId === recipientId && !notification.readAt) {
      notification.readAt = now;
      changed = true;
    }
  });
  if (changed) notifyListeners();
}

export function updateNotification(
  notificationId: string,
  patch: Partial<Pick<Notification, 'body' | 'readAt' | 'metadata'>>,
) {
  const notification = getNotificationById(notificationId);
  if (!notification) return false;
  Object.assign(notification, patch);
  notifyListeners();
  return true;
}

export function simulateNotification(recipientId: string, actorId: string, targetId: string) {
  return createNotification({
    type: 'friend_request',
    actorId,
    recipientId,
    targetId,
    title: 'Cerere nouă de prietenie',
    body: 'Cineva vrea să fie prieten cu tine.',
  });
}

// ============================================================ real backend ==
// The notify-* edge functions (notify-friend-request, notify-message,
// notify-join, notify-join-request, notify-join-response, notify-new-event)
// already insert into this real, persisted `notifications` table — so every
// notification type EXCEPT `event_invite` (a client-only feature with no
// backend at all, see lib/eventInvitations.ts) now has a real row. The
// functions above (createNotification and friends) stay local-array-only and
// are only still called for event_invite.

type DbNotification = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  title: string;
  body: string;
  data: { target_id?: string } | null;
  read_at: string | null;
  created_at: string;
};

function fromDbNotification(row: DbNotification): Notification {
  return {
    id: row.id,
    type: row.type,
    actorId: row.actor_id ?? '',
    recipientId: row.recipient_id,
    targetId: row.data?.target_id ?? '',
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export async function getRealNotifications(recipientId: string): Promise<Notification[]> {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []).map(fromDbNotification);
}

export async function getUnreadRealNotificationCount(): Promise<number> {
  const { data } = await supabase.rpc('unread_notification_count');
  return data ?? 0;
}

export async function markRealNotificationRead(notificationId: string): Promise<void> {
  await supabase.rpc('mark_notification_read', { p_notification_id: notificationId });
}

export async function markAllRealNotificationsRead(): Promise<void> {
  await supabase.rpc('mark_all_notifications_read');
}

export function subscribeToRealNotifications(recipientId: string, listener: Listener) {
  const channel = freshChannel(`notifications-${recipientId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${recipientId}` },
      listener,
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
