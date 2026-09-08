import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/lib/supabase';
import { freshChannel } from '@/lib/realtime';
import { getHostJoinRequests } from '@/lib/events';
import { getReviewablePending } from '@/lib/reviews';
import {
  getRealNotifications,
  getUnreadRealNotificationCount,
  markAllRealNotificationsRead,
  markRealNotificationRead,
  subscribeToRealNotifications,
  type Notification,
} from '@/lib/notifications';

type NotificationContextValue = {
  notifications: Notification[];
  unreadCount: number;
  pendingReviewCount: number;
  markRead: (notificationId: string) => void;
  markAllRead: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: PropsWithChildren) {
  const { user } = useUser();
  const [joinRequestCount, setJoinRequestCount] = useState(0);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [realNotifications, setRealNotifications] = useState<Notification[]>([]);
  const [realUnreadCount, setRealUnreadCount] = useState(0);

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

  const refreshPendingReviewCount = useCallback(async () => {
    if (!user) {
      setPendingReviewCount(0);
      return;
    }
    setPendingReviewCount((await getReviewablePending()).length);
  }, [user]);

  useEffect(() => {
    refreshPendingReviewCount();
  }, [refreshPendingReviewCount]);

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

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications: realNotifications,
      unreadCount: realUnreadCount + joinRequestCount + pendingReviewCount,
      pendingReviewCount,
      markRead: (notificationId) => {
        markRealNotificationRead(notificationId).then(refreshRealNotifications);
      },
      markAllRead: () => {
        markAllRealNotificationsRead().then(refreshRealNotifications);
      },
    }),
    [joinRequestCount, pendingReviewCount, realNotifications, realUnreadCount, refreshRealNotifications]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
}
