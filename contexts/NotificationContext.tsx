import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { useUser } from '@/contexts/UserContext';
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

  useEffect(() => subscribeToNotifications(() => setVersion((current) => current + 1)), []);

  const value = useMemo<NotificationContextValue>(() => {
    const recipientId = user?.id ?? '';
    return {
      notifications: recipientId ? getNotifications(recipientId) : [],
      unreadCount: recipientId ? getUnreadNotificationCount(recipientId) : 0,
      markRead: (notificationId) => recipientId && markNotificationRead(recipientId, notificationId),
      markAllRead: () => recipientId && markAllNotificationsRead(recipientId),
    };
  }, [user?.id, version]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
}
