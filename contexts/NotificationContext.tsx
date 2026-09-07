import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/lib/supabase';
import { freshChannel } from '@/lib/realtime';
import { getHostJoinRequests } from '@/lib/events';
import {
  getNotifications,
  getNotificationById,
  getRealNotifications,
  getUnreadNotificationCount,
  getUnreadRealNotificationCount,
  markAllNotificationsRead,
  markAllRealNotificationsRead,
  markNotificationRead,
  markRealNotificationRead,
  subscribeToNotifications,
  subscribeToRealNotifications,
  type Notification,
} from '@/lib/notifications';

type NotificationContextValue = {
  notifications: Notification[];
  unreadCount: number;
  markRead: (notificationId: string) => void;
  markAllRead: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: PropsWithChildren) {
  const { user } = useUser();
  const [version, setVersion] = useState(0);
  const [joinRequestCount, setJoinRequestCount] = useState(0);
  const [realNotifications, setRealNotifications] = useState<Notification[]>([]);
  const [realUnreadCount, setRealUnreadCount] = useState(0);

  // event_invite has no backend (see lib/eventInvitations.ts) — that's the
  // only type still served by the local array. Every other type now has a
  // real, persisted row inserted by its notify-* edge function.
  useEffect(() => subscribeToNotifications(() => setVersion((current) => current + 1)), []);

  const refreshRealNotifications = useCallback(async () => {
    if (!user) {
      setRealNotifications([]);
      setRealUnreadCount(0);
      return;
    }
    const [list, count] = await Promise.all([getRealNotifications(user.id), getUnreadRealNotificationCount()]);
    setRealNotifications(list);
    setRealUnreadCount(count);
  }, [user]);

  useEffect(() => {
    refreshRealNotifications();
  }, [refreshRealNotifications]);

  useEffect(() => {
    if (!user) return;
    return subscribeToRealNotifications(user.id, refreshRealNotifications);
  }, [user, refreshRealNotifications]);

  const refreshJoinRequestCount = useCallback(async () => {
    if (!user) {
      setJoinRequestCount(0);
      return;
    }
    setJoinRequestCount((await getHostJoinRequests(user.id)).length);
  }, [user]);

  useEffect(() => {
    refreshJoinRequestCount();
  }, [refreshJoinRequestCount]);

  // A nudge to recount, not the source of truth itself — any insert, accept,
  // or reject this user's RLS policies let them see on event_join_requests
  // (as either a host or a requester) just triggers a fresh fetch rather
  // than trying to patch the count in place from the raw payload.
  useEffect(() => {
    if (!user) return;
    const channel = freshChannel(`host-join-requests-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_join_requests' }, () => refreshJoinRequestCount())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refreshJoinRequestCount]);

  const value = useMemo<NotificationContextValue>(() => {
    const recipientId = user?.id ?? '';
    const localInvites = recipientId ? getNotifications(recipientId).filter((n) => n.type === 'event_invite') : [];
    const localUnread = localInvites.filter((n) => !n.readAt).length;

    return {
      notifications: [...realNotifications, ...localInvites].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      unreadCount: realUnreadCount + localUnread + joinRequestCount,
      markRead: (notificationId) => {
        if (!recipientId) return;
        if (getNotificationById(notificationId)) {
          markNotificationRead(recipientId, notificationId);
        } else {
          markRealNotificationRead(notificationId).then(refreshRealNotifications);
        }
      },
      markAllRead: () => {
        if (!recipientId) return;
        markAllNotificationsRead(recipientId);
        markAllRealNotificationsRead().then(refreshRealNotifications);
      },
    };
  }, [user?.id, version, joinRequestCount, realNotifications, realUnreadCount, refreshRealNotifications]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
}
