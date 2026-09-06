import { supabase } from '@/lib/supabase';

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

// notifications rows are written only server-side now (RPCs / notify-* edge
// functions — see supabase/migrations/..._add_notifications.sql, whose RLS
// has no client INSERT policy at all). This module keeps a small
// client-side read cache so NotificationContext can expose the same
// synchronous getters the original in-memory mock did, backed by a real
// fetch + realtime subscription instead of a local array.
let cache: Notification[] = [];
let cachedForRecipient: string | null = null;
let channel: ReturnType<typeof supabase.channel> | null = null;
const listeners = new Set<Listener>();

// Dev-only notifications injected by the notifications.tsx dev-tools panel
// (simulateNotification) — kept purely local, exactly like the mock this
// replaces ("doesn't reach Supabase"), so they're overlaid on top of the
// real cache rather than written to it.
const devNotifications: Notification[] = [];

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function fromRow(row: any): Notification {
  const data = row.data ?? {};
  return {
    id: row.id,
    type: row.type,
    actorId: row.actor_id,
    recipientId: row.recipient_id,
    targetId: data.target_id ?? row.actor_id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
    metadata: data,
  };
}

async function refresh(recipientId: string) {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })
    .limit(100);
  cache = (data ?? []).map(fromRow);
  notifyListeners();
}

// Lazily starts (or restarts, if the recipient changed) the fetch +
// realtime subscription backing the synchronous getters below. Called from
// inside those getters, so a component just reading `getNotifications(id)`
// is enough to keep the cache alive — no separate "init" call needed.
function ensureLoaded(recipientId: string) {
  if (cachedForRecipient === recipientId) return;
  cachedForRecipient = recipientId;
  refresh(recipientId);

  if (channel) supabase.removeChannel(channel);
  channel = supabase
    .channel(`notifications-${recipientId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${recipientId}` },
      () => refresh(recipientId)
    )
    .subscribe();
}

export function subscribeToNotifications(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getNotifications(recipientId: string): Notification[] {
  ensureLoaded(recipientId);
  const real = cachedForRecipient === recipientId ? cache : [];
  const dev = devNotifications.filter((n) => n.recipientId === recipientId);
  return [...dev, ...real].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getNotificationById(notificationId: string): Notification | null {
  return devNotifications.find((n) => n.id === notificationId) ?? cache.find((n) => n.id === notificationId) ?? null;
}

export function getUnreadNotificationCount(recipientId: string): number {
  return getNotifications(recipientId).filter((n) => !n.readAt).length;
}

export async function markNotificationRead(recipientId: string, notificationId: string) {
  const dev = devNotifications.find((n) => n.id === notificationId);
  if (dev) {
    if (!dev.readAt) {
      dev.readAt = new Date().toISOString();
      notifyListeners();
    }
    return;
  }
  await supabase.rpc('mark_notification_read', { p_notification_id: notificationId });
  await refresh(recipientId);
}

export async function markAllNotificationsRead(recipientId: string) {
  devNotifications.forEach((n) => {
    if (n.recipientId === recipientId) n.readAt = new Date().toISOString();
  });
  await supabase.rpc('mark_all_notifications_read');
  await refresh(recipientId);
}

// Kept as a no-op: every real notification is now written server-side (see
// the comment above), so a client-side "create" has nothing left to do —
// lib/messaging.ts's two call sites are harmless leftovers from before the
// notify-message edge function existed (it already writes the real row).
export function createNotification(_input: Omit<Notification, 'id' | 'createdAt' | 'readAt'>): void {}

export function updateNotification(
  notificationId: string,
  patch: Partial<Pick<Notification, 'body' | 'readAt' | 'metadata'>>
): boolean {
  const notification = devNotifications.find((n) => n.id === notificationId);
  if (!notification) return false;
  Object.assign(notification, patch);
  notifyListeners();
  return true;
}

// Dev-tools only (app/notifications.tsx) — purely local, never reaches
// Supabase, matching the panel's own "doesn't reach Supabase" disclaimer.
export function simulateNotification(recipientId: string, actorId: string, targetId: string) {
  const notification: Notification = {
    id: `dev-notification-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: 'friend_request',
    actorId,
    recipientId,
    targetId,
    title: 'Cerere nouă de prietenie',
    body: 'Cineva vrea să fie prieten cu tine.',
    createdAt: new Date().toISOString(),
    readAt: null,
  };
  devNotifications.push(notification);
  notifyListeners();
  return notification;
}
