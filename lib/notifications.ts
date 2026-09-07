export type NotificationType =
  | 'friend_request'
  | 'friend_request_accepted'
  | 'event_invite'
  | 'event_join'
  | 'event_updated'
  | 'event_cancelled'
  | 'message'
  | 'review';

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
