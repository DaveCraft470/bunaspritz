import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SpritzEvent } from '@/constants/events';
import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useEvents } from '@/contexts/EventsContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { getEventAttendeeCount } from '@/lib/events';

function isUpcoming(event: SpritzEvent) {
  return event.startsAt !== null && new Date(event.startsAt).getTime() >= Date.now();
}

function formatEventDate(startsAt: string | null) {
  if (!startsAt) return 'Data în curs de stabilire';
  return new Date(startsAt).toLocaleDateString('ro-RO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatEventTime(startsAt: string | null) {
  if (!startsAt) return 'Ora în curs de stabilire';
  return new Date(startsAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

function EventDashboardCard({
  event,
  attendeeCount,
  onView,
  onEdit,
  onParticipants,
}: {
  event: SpritzEvent;
  attendeeCount: number | undefined;
  onView: () => void;
  onEdit: () => void;
  onParticipants: () => void;
}) {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const upcoming = isUpcoming(event);
  const hasDate = event.startsAt !== null;
  const capacity = event.maxParticipants;
  const occupancy = capacity && attendeeCount !== undefined ? Math.min(Math.round((attendeeCount / capacity) * 100), 100) : null;

  return (
    <View style={[styles.eventCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.eventHeader}>
        <View style={[styles.eventIcon, { backgroundColor: event.color }]}>
          <Text style={styles.eventEmoji}>{event.emoji}</Text>
        </View>
        <View style={styles.eventHeading}>
          <Text style={[styles.eventTitle, { color: theme.textPrimary }]} numberOfLines={1}>{event.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: upcoming ? colors.green50 : theme.surfaceMuted }]}>
            <Text style={[styles.statusText, { color: upcoming ? colors.green700 : theme.textSecondary }]}>
              {upcoming ? 'Viitor' : hasDate ? 'Finalizat' : 'Data nestabilită'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.dateRow}>
        <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
        <Text style={[styles.dateText, { color: theme.textSecondary }]}>
          {formatEventDate(event.startsAt)} · {formatEventTime(event.startsAt)}
        </Text>
      </View>

      <View style={styles.attendeeRow}>
        <Ionicons name="people-outline" size={18} color={theme.accent} />
        <Text style={[styles.attendeeText, { color: theme.textPrimary }]}>
          {attendeeCount === undefined ? 'Se încarcă participanții...' : `${attendeeCount} participanți${capacity ? ` / ${capacity}` : ''}`}
        </Text>
      </View>

      {occupancy !== null && (
        <View style={styles.occupancyBlock}>
          <View style={styles.occupancyHeader}>
            <Text style={[styles.occupancyLabel, { color: theme.textSecondary }]}>Ocupare</Text>
            <Text style={[styles.occupancyValue, { color: theme.textPrimary }]}>{occupancy}%</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.surfaceMuted }]}>
            <View style={[styles.progressFill, { width: `${occupancy}%`, backgroundColor: colors.green500 }]} />
          </View>
        </View>
      )}

      <View style={styles.actionRow}>
        <AnimatedPressable
          onPress={() => {
            light();
            onView();
          }}
          style={[styles.secondaryButton, { borderColor: theme.border }]}
        >
          <Ionicons name="eye-outline" size={16} color={theme.textPrimary} />
          <Text style={[styles.secondaryButtonText, { color: theme.textPrimary }]}>Vezi</Text>
        </AnimatedPressable>
        <AnimatedPressable
          onPress={() => {
            light();
            onEdit();
          }}
          style={[styles.primaryButton, { backgroundColor: colors.green500 }]}
        >
          <Ionicons name="create-outline" size={16} color={colors.white} />
          <Text style={styles.primaryButtonText}>Editează</Text>
        </AnimatedPressable>
        <AnimatedPressable
          onPress={() => {
            light();
            onParticipants();
          }}
          style={[styles.secondaryButton, { borderColor: theme.border }]}
        >
          <Ionicons name="people-outline" size={16} color={theme.textPrimary} />
          <Text style={[styles.secondaryButtonText, { color: theme.textPrimary }]}>Participanți</Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}

export default function OrganizerDashboard() {
  const { colors: theme } = useAppTheme();
  const { events, loading: eventsLoading, error: eventsError, refresh } = useEvents();
  const { user } = useUser();
  const [refreshing, setRefreshing] = useState(false);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [attendeeCounts, setAttendeeCounts] = useState<Record<string, number>>({});

  const hostedEvents = useMemo(
    () => (user ? events.filter((event) => event.hostId === user.id) : []),
    [events, user]
  );
  const upcomingEvents = useMemo(() => hostedEvents.filter(isUpcoming), [hostedEvents]);
  const completedEvents = useMemo(() => hostedEvents.filter((event) => event.startsAt !== null && !isUpcoming(event)), [hostedEvents]);
  const undatedEvents = useMemo(() => hostedEvents.filter((event) => event.startsAt === null), [hostedEvents]);

  const loadCounts = useCallback(async () => {
    if (!hostedEvents.length) {
      setAttendeeCounts({});
      setLoadingCounts(false);
      return;
    }

    setLoadingCounts(true);
    const entries = await Promise.all(
      hostedEvents.map(async (event) => [event.id, await getEventAttendeeCount(event.id)] as const)
    );
    setAttendeeCounts(Object.fromEntries(entries));
    setLoadingCounts(false);
  }, [hostedEvents]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  const participantTotal = Object.values(attendeeCounts).reduce((total, count) => total + count, 0);
  const list = [...upcomingEvents, ...completedEvents, ...undatedEvents];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />
      {eventsLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={colors.green500} />
          <Text style={[styles.emptyTitle, { color: theme.textSecondary }]}>Se încarcă evenimentele...</Text>
        </View>
      ) : eventsError ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: theme.textSecondary }]}>Nu am putut încărca evenimentele.</Text>
          <AnimatedPressable onPress={() => void refresh()} style={[styles.createButton, { backgroundColor: colors.green500 }]}>
            <Text style={styles.primaryButtonText}>Reîncearcă</Text>
          </AnimatedPressable>
        </View>
      ) : (
      <FlatList
        data={list}
        keyExtractor={(event) => event.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.green500} />}
        ListHeaderComponent={
          <View>
            <View style={styles.topBar}>
              <AnimatedPressable
                onPress={() => router.back()}
                hitSlop={10}
                style={[styles.backButton, shadows.soft, { borderColor: glassButton.border }]}
                accessibilityLabel="Înapoi"
              >
                <Ionicons name="chevron-back" size={20} color={glassButton.icon} />
              </AnimatedPressable>
              <View style={styles.titleBlock}>
                <Text style={[styles.eyebrow, { color: theme.accent }]}>ORGANIZER MODE</Text>
                <Text style={[styles.title, { color: theme.textPrimary }]}>Dashboard</Text>
              </View>
              <View style={styles.backButton} />
            </View>

            <View style={styles.statsGrid}>
              <StatCard label="Total" value={hostedEvents.length} theme={theme} />
              <StatCard label="Viitoare" value={upcomingEvents.length} theme={theme} />
              <StatCard label="Finalizate" value={completedEvents.length} theme={theme} />
              <StatCard label="Participanți" value={loadingCounts ? null : participantTotal} theme={theme} />
            </View>

            {upcomingEvents.length > 0 && <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Viitoare</Text>}
            {upcomingEvents.length === 0 && completedEvents.length > 0 && (
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Evenimente</Text>
            )}
          </View>
        }
        renderItem={({ item, index }) => (
          <>
            {index === upcomingEvents.length && completedEvents.length > 0 && upcomingEvents.length > 0 && (
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Finalizate</Text>
            )}
            {index === upcomingEvents.length + completedEvents.length && undatedEvents.length > 0 && (
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Data nestabilită</Text>
            )}
            <EventDashboardCard
              event={item}
              attendeeCount={attendeeCounts[item.id]}
              onView={() => router.push(`/event/${item.id}`)}
              onEdit={() => router.push({ pathname: '/edit-event/[id]', params: { id: item.id } })}
              onParticipants={() => router.push({ pathname: '/organizer-participants/[id]', params: { id: item.id } })}
            />
          </>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {loadingCounts ? (
              <ActivityIndicator color={colors.green500} />
            ) : (
              <>
                <Ionicons name="calendar-outline" size={42} color={theme.textSecondary} />
                <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>Nu ai încă evenimente create.</Text>
                <AnimatedPressable onPress={() => router.push('/new-event')} style={[styles.createButton, { backgroundColor: colors.green500 }]}>
                  <Ionicons name="add" size={20} color={colors.white} />
                  <Text style={styles.primaryButtonText}>Creează eveniment</Text>
                </AnimatedPressable>
              </>
            )}
          </View>
        }
      />
      )}
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  theme,
}: {
  label: string;
  value: number | null;
  theme: ReturnType<typeof useAppTheme>['colors'];
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {value === null ? <ActivityIndicator color={colors.green500} /> : <Text style={[styles.statNumber, { color: theme.textPrimary }]}>{value}</Text>}
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 120 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { alignItems: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  title: { fontSize: 26, fontWeight: '800', marginTop: 3 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { width: '48%', minHeight: 82, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1 },
  statNumber: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: spacing.sm, marginTop: spacing.sm },
  eventCard: { borderRadius: 18, borderWidth: 1, padding: spacing.md, marginBottom: spacing.md },
  eventHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  eventIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  eventEmoji: { fontSize: 24 },
  eventHeading: { flex: 1, gap: 5 },
  eventTitle: { fontSize: 16, fontWeight: '800' },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '800' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: spacing.md },
  dateText: { flex: 1, fontSize: 12, textTransform: 'capitalize' },
  attendeeRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: spacing.sm },
  attendeeText: { fontSize: 13, fontWeight: '700' },
  occupancyBlock: { marginTop: spacing.sm },
  occupancyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  occupancyLabel: { fontSize: 11 },
  occupancyValue: { fontSize: 11, fontWeight: '800' },
  progressTrack: { height: 7, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  secondaryButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderRadius: 11, paddingVertical: 10 },
  secondaryButtonText: { fontSize: 12, fontWeight: '800' },
  primaryButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 11, paddingVertical: 10 },
  primaryButtonText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: spacing.md },
  emptyTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  createButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 13, paddingHorizontal: 18, paddingVertical: 12 },
});
