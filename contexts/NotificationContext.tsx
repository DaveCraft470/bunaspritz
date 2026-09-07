import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/lib/supabase';
import { freshChannel } from '@/lib/realtime';
import { getHostJoinRequests } from '@/lib/events';
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
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

  useEffect(() => subscribeToNotifications(() => setVersion((current) => current + 1)), []);

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
    return {
      notifications: recipientId ? getNotifications(recipientId) : [],
      unreadCount: (recipientId ? getUnreadNotificationCount(recipientId) : 0) + joinRequestCount,
      markRead: (notificationId) => recipientId && markNotificationRead(recipientId, notificationId),
      markAllRead: () => recipientId && markAllNotificationsRead(recipientId),
    };
  }, [user?.id, version, joinRequestCount]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
}
