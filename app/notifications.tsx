import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUser } from '@/contexts/UserContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useEvents } from '@/contexts/EventsContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Avatar } from '@/components/common/Avatar';
import { GlassSurface } from '@/components/common/GlassSurface';
import { getProfile, type Profile } from '@/lib/social';
import { ensureDevPeer } from '@/lib/devFixtures';
import { simulateNotification, type Notification } from '@/lib/notifications';
import { acceptEventInvitation, declineEventInvitation, getEventInvitation, simulateEventInvitation } from '@/lib/eventInvitations';
import { getHostJoinRequests, respondToJoinRequest, type HostJoinRequest } from '@/lib/events';

const notificationIcons: Record<Notification['type'], keyof typeof Ionicons.glyphMap> = {
  friend_request: 'person-add-outline',
  friend_request_accepted: 'people-outline',
  event_invite: 'calendar-outline',
  event_join: 'calendar-number-outline',
  event_updated: 'create-outline',
  event_cancelled: 'close-circle-outline',
  message: 'chatbubble-ellipses-outline',
  review: 'star-outline',
  system: 'information-circle-outline',
};

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function Notifications() {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const { t, locale } = useLanguage();
  const { user } = useUser();
  const { events } = useEvents();
  const { notifications, unreadCount, pendingReviewCount, markRead, markAllRead } = useNotifications();
  const [actors, setActors] = useState<Record<string, Profile>>({});
  const [joinRequests, setJoinRequests] = useState<HostJoinRequest[]>([]);
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const loadJoinRequests = useCallback(async () => {
    if (!user) {
      setJoinRequests([]);
      return;
    }
    setJoinRequestsLoading(true);
    try {
      setJoinRequests(await getHostJoinRequests(user.id));
    } finally {
      setJoinRequestsLoading(false);
    }
  }, [user]);

  // The DB, not the local fake notification store, is the source of truth
  // here — a request created by a guest on another device would never reach
  // this host if it only lived in that in-memory array (see lib/notifications.ts).
  useFocusEffect(
    useCallback(() => {
      loadJoinRequests();
    }, [loadJoinRequests]),
  );

  async function respondToRequest(request: HostJoinRequest, approve: boolean) {
    light();
    setRespondingId(request.id);
    const ok = await respondToJoinRequest(request.id, approve);
    setRespondingId(null);
    if (!ok) return;
    setJoinRequests((current) => current.filter((item) => item.id !== request.id));
  }

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
    } else if (notification.type.startsWith('event_') || notification.type === 'system') {
      // 'system' covers join-request/join-response notifications, whose
      // target is always the event, not a user.
      router.push(`/event/${notification.targetId}`);
    } else {
      router.push(`/user/${notification.targetId}`);
    }
  }

  function handleInvitationAction(notification: Notification, action: 'accept' | 'decline') {
    if (!user || notification.type !== 'event_invite') return;
    const invitationId = notification.metadata?.invitationId;
    if (!invitationId) return;
    const result = action === 'accept'
      ? acceptEventInvitation(user.id, invitationId)
      : declineEventInvitation(user.id, invitationId);
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
          accessibilityLabel={t.common.back}
          style={[styles.backButton, shadows.soft, { borderColor: glassButton.border }]}
        >
          <GlassSurface />
          <Ionicons name="chevron-back" size={20} color={glassButton.icon} />
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.textPrimary }]}>{t.notifications.title}</Text>
        <AnimatedPressable
          onPress={() => {
            light();
            markAllRead();
          }}
          disabled={!unreadCount}
          hitSlop={8}
          accessibilityLabel={t.notifications.markAllRead}
          style={styles.markAllButton}
        >
          <Ionicons name="checkmark-done-outline" size={21} color={unreadCount ? theme.accent : theme.border} />
        </AnimatedPressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {pendingReviewCount > 0 && (
          <AnimatedPressable
            onPress={() => {
              light();
              router.push('/reviews');
            }}
            style={[styles.notificationRow, { backgroundColor: theme.surface, borderColor: colors.green400 }]}
          >
            <Ionicons name="star-outline" size={22} color="#F5B301" />
            <View style={styles.notificationCopy}>
              <Text style={[styles.notificationTitle, { color: theme.textPrimary }]}>Recenzii de acordat</Text>
              <Text style={[styles.notificationBody, { color: theme.textSecondary }]}>
                {pendingReviewCount === 1
                  ? 'O persoană așteaptă recenzia ta.'
                  : `${pendingReviewCount} persoane așteaptă recenzia ta.`}
              </Text>
            </View>
          </AnimatedPressable>
        )}

        {joinRequestsLoading && joinRequests.length === 0 && (
          <ActivityIndicator color={colors.green500} style={styles.joinRequestsLoader} />
        )}

        {joinRequests.length > 0 && (
          <>
            <Text style={[styles.historyLabel, { color: theme.textSecondary }]}>CERERI DE PARTICIPARE</Text>
            {joinRequests.map((request) => (
              <View
                key={request.id}
                style={[styles.notificationRow, { backgroundColor: theme.surface, borderColor: colors.green400 }]}
              >
                <AnimatedPressable onPress={() => router.push(`/user/${request.userId}`)}>
                  <Avatar uri={request.avatarUrl} name={request.name} size={34} fontSize={14} />
                </AnimatedPressable>
                <View style={styles.notificationCopy}>
                  <Text style={[styles.notificationTitle, { color: theme.textPrimary }]}>{request.name || `@${request.username}`}</Text>
                  <Text style={[styles.notificationBody, { color: theme.textSecondary }]}>
                    Vrea să participe la {request.eventTitle}.
                  </Text>
                  <View style={styles.invitationActions}>
                    <AnimatedPressable
                      onPress={() => respondToRequest(request, true)}
                      disabled={respondingId === request.id}
                      style={[styles.invitationAccept, { backgroundColor: colors.green500 }]}
                    >
                      <Text style={styles.invitationAcceptText}>Acceptă</Text>
                    </AnimatedPressable>
                    <AnimatedPressable
                      onPress={() => respondToRequest(request, false)}
                      disabled={respondingId === request.id}
                      style={[styles.invitationDecline, { borderColor: theme.border }]}
                    >
                      <Text style={[styles.invitationDeclineText, { color: theme.textPrimary }]}>Refuză</Text>
                    </AnimatedPressable>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        {unreadCount === 0 && <Text style={[styles.emptyNew, { color: theme.textSecondary }]}>{t.notifications.noNewNotifications}</Text>}

        {notifications.length > 0 && unreadCount === 0 && <Text style={[styles.historyLabel, { color: theme.textSecondary }]}>{t.notifications.history}</Text>}

        {notifications.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={32} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t.notifications.emptyHint}</Text>
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
                <Text style={[styles.notificationDate, { color: theme.textSecondary }]}>{formatDate(notification.createdAt, locale)}</Text>
                {notification.type === 'event_invite' && notification.metadata?.invitationId && (() => {
                  const invitation = getEventInvitation(notification.metadata.invitationId);
                  if (!invitation || invitation.status !== 'pending') {
                    return <Text style={[styles.invitationStatus, { color: theme.textSecondary }]}>{invitation?.status === 'accepted' ? t.notifications.accepted : t.notifications.declined}</Text>;
                  }
                  return (
                    <View style={styles.invitationActions}>
                      <AnimatedPressable
                        onPress={() => handleInvitationAction(notification, 'accept')}
                        style={[styles.invitationAccept, { backgroundColor: colors.green500 }]}
                      >
                        <Text style={styles.invitationAcceptText}>{t.notifications.accept}</Text>
                      </AnimatedPressable>
                      <AnimatedPressable
                        onPress={() => handleInvitationAction(notification, 'decline')}
                        style={[styles.invitationDecline, { borderColor: theme.border }]}
                      >
                        <Text style={[styles.invitationDeclineText, { color: theme.textPrimary }]}>{t.notifications.decline}</Text>
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
            <Text style={[styles.devTitle, { color: theme.textPrimary }]}>{t.notifications.devToolsTitle}</Text>
            <Text style={[styles.devHint, { color: theme.textSecondary }]}>{t.notifications.devToolsHint}</Text>
            <View style={styles.devGrid}>
              <DevButton
                label={t.notifications.devTestNotification}
                onPress={() => runDev(() => simulateNotification(user.id, ensureDevPeer(user.id).id, user.id))}
                theme={theme}
              />
              {events[0] && (
                <DevButton
                  label={t.notifications.devEventInvitation}
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
  joinRequestsLoader: { marginBottom: 12 },
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
