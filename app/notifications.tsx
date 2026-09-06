import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useEvents } from '@/contexts/EventsContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Avatar } from '@/components/common/Avatar';
import { GlassSurface } from '@/components/common/GlassSurface';
import { getProfile, type Profile } from '@/lib/social';
import {
  ensureDevPeer,
  simulateAcceptedFriendRequest,
  simulateIncomingFriendRequest,
  simulateOutgoingFriendRequest,
} from '@/lib/friendRequests';
import { simulateNotification, type Notification } from '@/lib/notifications';
import { acceptEventInvitation, declineEventInvitation, getEventInvitation, simulateEventInvitation } from '@/lib/eventInvitations';

const notificationIcons: Record<Notification['type'], keyof typeof Ionicons.glyphMap> = {
  friend_request: 'person-add-outline',
  friend_request_accepted: 'people-outline',
  event_invite: 'calendar-outline',
  event_join: 'calendar-number-outline',
  event_updated: 'create-outline',
  event_cancelled: 'close-circle-outline',
  message: 'chatbubble-ellipses-outline',
  review: 'star-outline',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function Notifications() {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const { user } = useUser();
  const { events } = useEvents();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [actors, setActors] = useState<Record<string, Profile>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      notifications.map(async (notification) => {
        const local = notification.actorId.startsWith('dev-peer-') ? ensureDevPeer(user?.id ?? '') : null;
        return [notification.actorId, local ?? (await getProfile(notification.actorId))] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      setActors(Object.fromEntries(entries.filter((entry): entry is [string, Profile] => !!entry[1])));
    });
    return () => {
      cancelled = true;
    };
  }, [notifications, user?.id]);

  function openNotification(notification: Notification) {
    light();
    markRead(notification.id);
    if (notification.type === 'message') {
      router.push('/messages');
    } else if (notification.type.startsWith('event_')) {
      router.push(`/event/${notification.targetId}`);
    } else {
      router.push(`/user/${notification.targetId}`);
    }
  }

  async function handleInvitationAction(notification: Notification, action: 'accept' | 'decline') {
    if (!user || notification.type !== 'event_invite') return;
    const invitationId = notification.metadata?.invitationId;
    if (!invitationId) return;
    const result = action === 'accept'
      ? await acceptEventInvitation(user.id, invitationId)
      : await declineEventInvitation(user.id, invitationId);
    if (!result.ok) return;
    markRead(notification.id);
    if (action === 'accept') router.push(`/event/${notification.targetId}`);
  }

  function runDev(action: () => void) {
    if (!__DEV__) return;
    light();
    action();
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}> 
      <StatusBar style={theme.statusBar} />
      <View style={styles.topBar}>
        <AnimatedPressable
          onPress={() => {
            light();
            router.back();
          }}
          hitSlop={10}
          accessibilityLabel="Înapoi"
          style={[styles.backButton, shadows.soft, { borderColor: glassButton.border }]}
        >
          <GlassSurface />
          <Ionicons name="chevron-back" size={20} color={glassButton.icon} />
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Notificări</Text>
        <AnimatedPressable
          onPress={() => {
            light();
            markAllRead();
          }}
          disabled={!unreadCount}
          hitSlop={8}
          accessibilityLabel="Marchează tot ca citit"
          style={styles.markAllButton}
        >
          <Ionicons name="checkmark-done-outline" size={21} color={unreadCount ? theme.accent : theme.border} />
        </AnimatedPressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {unreadCount === 0 && <Text style={[styles.emptyNew, { color: theme.textSecondary }]}>Nu ai notificări noi.</Text>}

        {notifications.length > 0 && unreadCount === 0 && <Text style={[styles.historyLabel, { color: theme.textSecondary }]}>ISTORIC</Text>}

        {notifications.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={32} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Notificările noi vor apărea aici.</Text>
          </View>
        )}

        {notifications.map((notification) => {
          const actor = actors[notification.actorId];
          return (
            <AnimatedPressable
              key={notification.id}
              onPress={() => openNotification(notification)}
              style={[
                styles.notificationRow,
                {
                  backgroundColor: notification.readAt ? theme.surfaceMuted : theme.surface,
                  borderColor: notification.readAt ? theme.border : colors.green400,
                },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: notification.readAt ? theme.surface : colors.green50 }]}>
                {actor ? (
                  <Avatar uri={actor.avatar_url} name={actor.name} size={34} fontSize={14} />
                ) : (
                  <Ionicons name={notificationIcons[notification.type]} size={19} color={theme.accent} />
                )}
              </View>
              <View style={styles.notificationCopy}>
                <Text style={[styles.notificationTitle, { color: theme.textPrimary }]}>{notification.title}</Text>
                <Text style={[styles.notificationBody, { color: theme.textSecondary }]}>{notification.body}</Text>
                <Text style={[styles.notificationDate, { color: theme.textSecondary }]}>{formatDate(notification.createdAt)}</Text>
                {notification.type === 'event_invite' && notification.metadata?.invitationId && (() => {
                  const invitation = getEventInvitation(notification.metadata.invitationId);
                  if (!invitation || invitation.status !== 'pending') {
                    return <Text style={[styles.invitationStatus, { color: theme.textSecondary }]}>{invitation?.status === 'accepted' ? 'Acceptată' : 'Refuzată'}</Text>;
                  }
                  return (
                    <View style={styles.invitationActions}>
                      <AnimatedPressable
                        onPress={() => handleInvitationAction(notification, 'accept')}
                        style={[styles.invitationAccept, { backgroundColor: colors.green500 }]}
                      >
                        <Text style={styles.invitationAcceptText}>Acceptă</Text>
                      </AnimatedPressable>
                      <AnimatedPressable
                        onPress={() => handleInvitationAction(notification, 'decline')}
                        style={[styles.invitationDecline, { borderColor: theme.border }]}
                      >
                        <Text style={[styles.invitationDeclineText, { color: theme.textPrimary }]}>Refuză</Text>
                      </AnimatedPressable>
                    </View>
                  );
                })()}
              </View>
              {!notification.readAt && <View style={[styles.unreadDot, { backgroundColor: colors.green500 }]} />}
            </AnimatedPressable>
          );
        })}

        {__DEV__ && user && (
          <View style={[styles.devTools, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
            <Text style={[styles.devTitle, { color: theme.textPrimary }]}>Developer Tools</Text>
            <Text style={[styles.devHint, { color: theme.textSecondary }]}>Doar local, dispare la restart și nu ajunge în Supabase.</Text>
            <View style={styles.devGrid}>
              <DevButton label="Cerere primită" onPress={() => runDev(() => simulateIncomingFriendRequest(user.id))} theme={theme} />
              <DevButton label="Cerere trimisă" onPress={() => runDev(() => simulateOutgoingFriendRequest(user.id))} theme={theme} />
              <DevButton label="Cerere acceptată" onPress={() => runDev(() => simulateAcceptedFriendRequest(user.id))} theme={theme} />
              <DevButton
                label="Notificare test"
                onPress={() => runDev(() => simulateNotification(user.id, ensureDevPeer(user.id).id, user.id))}
                theme={theme}
              />
              {events[0] && (
                <DevButton
                  label="Invitație la event"
                  onPress={() => runDev(() => simulateEventInvitation(user.id, events[0], ensureDevPeer(user.id).id, ensureDevPeer(user.id).name))}
                  theme={theme}
                />
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DevButton({ label, onPress, theme }: { label: string; onPress: () => void; theme: typeof import('@/constants/theme').lightColors }) {
  return (
    <AnimatedPressable onPress={onPress} style={[styles.devButton, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}> 
      <Text style={[styles.devButtonText, { color: theme.textPrimary }]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  markAllButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  emptyNew: { textAlign: 'center', fontSize: 13, fontStyle: 'italic', paddingVertical: 12 },
  historyLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 8, marginBottom: 10 },
  emptyState: { alignItems: 'center', gap: 10, paddingVertical: 34 },
  emptyText: { fontSize: 13, textAlign: 'center' },
  notificationRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 11, marginBottom: 10 },
  iconWrap: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  notificationCopy: { flex: 1 },
  notificationTitle: { fontSize: 14, fontWeight: '800' },
  notificationBody: { fontSize: 12, marginTop: 2 },
  notificationDate: { fontSize: 10, marginTop: 5 },
  invitationStatus: { fontSize: 11, fontWeight: '800', marginTop: 8 },
  invitationActions: { flexDirection: 'row', gap: 7, marginTop: 9 },
  invitationAccept: { minHeight: 42, borderRadius: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  invitationAcceptText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  invitationDecline: { minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  invitationDeclineText: { fontSize: 11, fontWeight: '800' },
  unreadDot: { width: 9, height: 9, borderRadius: 5 },
  devTools: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 20 },
  devTitle: { fontSize: 14, fontWeight: '800' },
  devHint: { fontSize: 11, marginTop: 3, marginBottom: 12 },
  devGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  devButton: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 8 },
  devButtonText: { fontSize: 11, fontWeight: '700' },
});
