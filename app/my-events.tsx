import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { SpritzEvent } from '@/constants/events';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useEvents } from '@/contexts/EventsContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { getUserJoinedEventIds } from '@/lib/events';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';

type Tab = 'particip' | 'organizez';

function hasStart(event: SpritzEvent): event is SpritzEvent & { startsAt: string } {
  return event.startsAt !== null;
}

function sortUpcoming(left: SpritzEvent, right: SpritzEvent) {
  if (!hasStart(left) || !hasStart(right)) return 0;
  return new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
}

function sortPast(left: SpritzEvent, right: SpritzEvent) {
  if (!hasStart(left) || !hasStart(right)) return 0;
  return new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime();
}

function formatDate(event: SpritzEvent) {
  if (!event.startsAt) return 'Data în curs de stabilire';
  return new Date(event.startsAt).toLocaleDateString('ro-RO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(event: SpritzEvent) {
  return event.startsAt
    ? new Date(event.startsAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
    : 'Ora în curs de stabilire';
}

function EventCard({ event, onPress }: { event: SpritzEvent; onPress: () => void }) {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();

  return (
    <AnimatedPressable
      onPress={() => {
        light();
        onPress();
      }}
      style={[styles.eventCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={[styles.eventIcon, { backgroundColor: event.color }]}>
        <Text style={styles.eventEmoji}>{event.emoji}</Text>
      </View>
      <View style={styles.eventCopy}>
        <Text style={[styles.eventTitle, { color: theme.textPrimary }]} numberOfLines={1}>{event.title}</Text>
        <Text style={[styles.eventMeta, { color: theme.textSecondary }]}>
          {formatDate(event)} · {formatTime(event)}
        </Text>
        {(event.genre || event.entryFeeRon !== null) && (
          <Text style={[styles.eventMeta, { color: theme.textSecondary }]} numberOfLines={1}>
            {[event.genre, event.entryFeeRon === null ? null : event.entryFeeRon === 0 ? 'Gratis' : `${event.entryFeeRon} RON`]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </AnimatedPressable>
  );
}

export default function MyEvents() {
  const { colors: theme } = useAppTheme();
  const { events, loading: eventsLoading, error: eventsError, refresh } = useEvents();
  const { user } = useUser();
  const [tab, setTab] = useState<Tab>('particip');
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [joinedLoading, setJoinedLoading] = useState(true);
  const [joinedError, setJoinedError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadJoined = useCallback(async () => {
    if (!user) {
      setJoinedLoading(false);
      return;
    }
    setJoinedLoading(true);
    setJoinedError(false);
    try {
      setJoinedIds(new Set(await getUserJoinedEventIds(user.id)));
    } catch {
      setJoinedError(true);
    } finally {
      setJoinedLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadJoined();
    }, [loadJoined]),
  );

  const ownedEvents = useMemo(
    () => (user ? events.filter((event) => event.hostId === user.id) : []),
    [events, user],
  );
  const participatedEvents = useMemo(
    () => events.filter((event) => joinedIds.has(event.id) && event.hostId !== user?.id),
    [events, joinedIds, user],
  );
  const sourceEvents = tab === 'particip' ? participatedEvents : ownedEvents;
  const upcoming = useMemo(
    () => sourceEvents.filter((event) => hasStart(event) && new Date(event.startsAt).getTime() >= Date.now()).sort(sortUpcoming),
    [sourceEvents],
  );
  const past = useMemo(
    () => sourceEvents.filter((event) => hasStart(event) && new Date(event.startsAt).getTime() < Date.now()).sort(sortPast),
    [sourceEvents],
  );
  const undated = useMemo(() => sourceEvents.filter((event) => !hasStart(event)), [sourceEvents]);
  const loading = eventsLoading || joinedLoading;
  const error = eventsError || joinedError;

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refresh(), loadJoined()]);
    setRefreshing(false);
  }

  function retry() {
    void handleRefresh();
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />
      <View style={styles.topBar}>
        <AnimatedPressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityLabel="Înapoi"
          style={[styles.backButton, shadows.soft, { borderColor: glassButton.border }]}
        >
          <Ionicons name="chevron-back" size={20} color={glassButton.icon} />
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Evenimentele mele</Text>
        <View style={styles.backButton} />
      </View>

      <View style={[styles.tabs, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {([
          ['particip', 'Particip'],
          ['organizez', 'Organizez'],
        ] as const).map(([value, label]) => (
          <AnimatedPressable
            key={value}
            onPress={() => setTab(value)}
            style={[styles.tab, tab === value && { backgroundColor: colors.green500 }]}
          >
            <Text style={[styles.tabText, { color: tab === value ? colors.white : theme.textSecondary }]}>{label}</Text>
          </AnimatedPressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.green500} />
          <Text style={[styles.stateText, { color: theme.textSecondary }]}>Se încarcă evenimentele...</Text>
        </View>
      ) : error ? (
        <View style={styles.state}>
          <Text style={[styles.stateText, { color: theme.textSecondary }]}>Nu am putut încărca evenimentele.</Text>
          <AnimatedPressable onPress={retry} style={[styles.retryButton, { backgroundColor: colors.green500 }]}>
            <Text style={styles.retryText}>Reîncearcă</Text>
          </AnimatedPressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.green500} />}
          showsVerticalScrollIndicator={false}
        >
          {sourceEvents.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {tab === 'particip' ? 'Nu participi încă la niciun eveniment.' : 'Nu ai creat încă niciun eveniment.'}
            </Text>
          ) : (
            <>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Urmează</Text>
              {upcoming.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Nu ai evenimente viitoare.</Text>
              ) : (
                upcoming.map((event) => <EventCard key={event.id} event={event} onPress={() => router.push(`/event/${event.id}`)} />)
              )}
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Trecute</Text>
              {past.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Nu ai evenimente trecute.</Text>
              ) : (
                past.map((event) => <EventCard key={event.id} event={event} onPress={() => router.push(`/event/${event.id}`)} />)
              )}
              {undated.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Data nestabilită</Text>
                  {undated.map((event) => <EventCard key={event.id} event={event} onPress={() => router.push(`/event/${event.id}`)} />)}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  tabs: { flexDirection: 'row', marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: 4, borderRadius: 16, borderWidth: 1 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12 },
  tabText: { fontSize: 13, fontWeight: '800' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginTop: spacing.md, marginBottom: spacing.sm },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: spacing.md },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  stateText: { fontSize: 14, textAlign: 'center' },
  retryButton: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14 },
  retryText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  eventCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: 16, borderWidth: 1, padding: 13, marginBottom: spacing.sm },
  eventIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  eventEmoji: { fontSize: 23 },
  eventCopy: { flex: 1 },
  eventTitle: { fontSize: 15, fontWeight: '800' },
  eventMeta: { fontSize: 11, marginTop: 4 },
});
