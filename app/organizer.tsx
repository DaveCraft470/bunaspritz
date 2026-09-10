import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useEvents } from '@/contexts/EventsContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUser } from '@/contexts/UserContext';
import { SpritzEvent } from '@/constants/events';
import { getEventAttendeeCount } from '@/lib/events';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import type { Translations } from '@/lib/i18n/ro';

function isUpcoming(event: SpritzEvent) {
  return event.startsAt !== null && new Date(event.startsAt).getTime() >= Date.now();
}

function formatEventDate(startsAt: string | null, t: Translations, locale: string) {
  if (!startsAt) return t.organizer.dateTbd;
  return new Date(startsAt).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function EventRow({ event, onPress }: { event: SpritzEvent; onPress: () => void }) {
  const { colors: theme } = useAppTheme();
  const { t, locale } = useLanguage();

  return (
    <AnimatedPressable
      onPress={onPress}
      style={[styles.eventCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={[styles.eventIcon, { backgroundColor: event.color }]}>
        <Text style={styles.eventEmoji}>{event.emoji}</Text>
      </View>
      <View style={styles.eventCopy}>
        <Text style={[styles.eventTitle, { color: theme.textPrimary }]} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={[styles.eventDate, { color: theme.textSecondary }]}>{formatEventDate(event.startsAt, t, locale)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </AnimatedPressable>
  );
}

export default function Organizer() {
  const { colors: theme } = useAppTheme();
  const { t } = useLanguage();
  const { events, loading: eventsLoading, error: eventsError, refresh } = useEvents();
  const { user, effectiveVerified } = useUser();
  const { light } = useHaptics();
  const [refreshing, setRefreshing] = useState(false);
  const [participantTotal, setParticipantTotal] = useState(0);
  const [loadingParticipants, setLoadingParticipants] = useState(true);

  const hostedEvents = useMemo(
    () => (user ? events.filter((event) => event.hostId === user.id) : []),
    [events, user]
  );
  const upcomingEvents = useMemo(() => hostedEvents.filter(isUpcoming), [hostedEvents]);
  const completedEvents = useMemo(() => hostedEvents.filter((event) => event.startsAt !== null && !isUpcoming(event)), [hostedEvents]);
  const undatedEvents = useMemo(() => hostedEvents.filter((event) => event.startsAt === null), [hostedEvents]);

  const loadParticipantTotal = useCallback(async () => {
    setLoadingParticipants(true);
    const counts = await Promise.all(hostedEvents.map((event) => getEventAttendeeCount(event.id)));
    setParticipantTotal(counts.reduce((total, count) => total + count, 0));
    setLoadingParticipants(false);
  }, [hostedEvents]);

  useEffect(() => {
    loadParticipantTotal();
  }, [loadParticipantTotal]);

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  function openEvent(event: SpritzEvent) {
    light();
    router.push(`/event/${event.id}`);
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />
      {eventsLoading ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.green500} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t.organizer.loadingEvents}</Text>
        </View>
      ) : eventsError ? (
        <View style={styles.state}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t.organizer.couldNotLoadEvents}</Text>
          <AnimatedPressable onPress={() => void refresh()} style={[styles.retryButton, { borderColor: theme.border }]}>
            <Text style={[styles.retryText, { color: theme.textPrimary }]}>{t.organizer.retry}</Text>
          </AnimatedPressable>
        </View>
      ) : (
      <FlatList
        data={[...upcomingEvents, ...completedEvents, ...undatedEvents]}
        keyExtractor={(event) => event.id}
        renderItem={({ item, index }) => {
          const isFirstCompleted = index === upcomingEvents.length;
          return (
            <>
              {isFirstCompleted && completedEvents.length > 0 && (
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t.organizer.completed}</Text>
              )}
              {index === upcomingEvents.length + completedEvents.length && (
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t.organizer.undatedSection}</Text>
              )}
              <EventRow event={item} onPress={() => openEvent(item)} />
            </>
          );
        }}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View>
                <Text style={[styles.eyebrow, { color: theme.accent }]}>{t.organizer.eyebrow}</Text>
                <Text style={[styles.title, { color: theme.textPrimary }]}>{t.organizer.title}</Text>
              </View>
              <View style={styles.headerActions}>
                <AnimatedPressable
                  onPress={() => {
                    light();
                    router.push('/organizer-dashboard');
                  }}
                  style={[styles.headerAction, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  accessibilityLabel={t.organizer.organizerDashboard}
                >
                  <Ionicons name="stats-chart-outline" size={18} color={theme.accent} />
                  <Text style={[styles.headerActionText, { color: theme.accent }]}>{t.organizer.dashboard}</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  onPress={() => {
                    light();
                    router.push('/organizer-calendar');
                  }}
                  hitSlop={10}
                  accessibilityLabel={t.organizer.organizerCalendar}
                >
                  <Ionicons name="calendar-outline" size={28} color={theme.accent} />
                </AnimatedPressable>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.statNumber, { color: theme.textPrimary }]}>{upcomingEvents.length}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.organizer.upcoming}</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.statNumber, { color: theme.textPrimary }]}>{completedEvents.length}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.organizer.completed}</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                {loadingParticipants ? (
                  <ActivityIndicator color={colors.green500} />
                ) : (
                  <Text style={[styles.statNumber, { color: theme.textPrimary }]}>{participantTotal}</Text>
                )}
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.organizer.participants}</Text>
              </View>
            </View>

            <AnimatedPressable
              onPress={() => {
                light();
                if (effectiveVerified) {
                  router.push('/new-event');
                } else {
                  router.push({ pathname: '/verification', params: { returnTo: '/organizer', reason: 'host' } });
                }
              }}
              style={[
                styles.createButton,
                effectiveVerified ? { backgroundColor: colors.green500 } : { backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.border },
              ]}
            >
              <Ionicons name={effectiveVerified ? 'add' : 'lock-closed'} size={effectiveVerified ? 22 : 18} color={effectiveVerified ? colors.white : theme.textSecondary} />
              <Text style={[styles.createButtonText, !effectiveVerified && { color: theme.textSecondary }]}>
                {effectiveVerified ? t.organizer.createEvent : t.hostGate.verifyFirst}
              </Text>
            </AnimatedPressable>

            {upcomingEvents.length > 0 && (
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t.organizer.upcoming}</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {t.organizer.noEventsYet}
          </Text>
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.green500} />}
      />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerAction: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8 },
  headerActionText: { fontSize: 12, fontWeight: '800' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 26, fontWeight: '800', marginTop: 4 },
  statsGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statCard: { flex: 1, alignItems: 'center', minHeight: 82, justifyContent: 'center', borderRadius: 16, borderWidth: 1 },
  statNumber: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  createButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 15, paddingVertical: 15, marginBottom: spacing.lg },
  createButtonText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: spacing.sm, marginTop: spacing.sm },
  eventCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: 16, borderWidth: 1, padding: 13, marginBottom: spacing.sm },
  eventIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  eventEmoji: { fontSize: 23 },
  eventCopy: { flex: 1 },
  eventTitle: { fontSize: 15, fontWeight: '800' },
  eventDate: { fontSize: 11, marginTop: 4 },
  emptyText: { textAlign: 'center', fontSize: 14, paddingVertical: spacing.xl },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  retryButton: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { fontSize: 13, fontWeight: '800' },
});
