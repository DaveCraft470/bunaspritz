import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { getEventAttendeeCount, getRecentAttendedEventIds } from '@/lib/events';
import { getEventPhotos, getSignedEventPhotoUrl } from '@/lib/eventPhotos';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';

type Recap = { event: SpritzEvent; attendeeCount: number; photoCount: number; coverUrl: string | null };

function formatDate(event: SpritzEvent) {
  if (!event.startsAt) return '';
  return new Date(event.startsAt).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function RecapCard({ recap }: { recap: Recap }) {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const { event, attendeeCount, photoCount, coverUrl } = recap;

  return (
    <AnimatedPressable
      onPress={() => {
        light();
        router.push(`/event/${event.id}`);
      }}
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      {coverUrl ? (
        <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="cover" />
      ) : (
        <View style={[styles.cover, styles.coverFallback, { backgroundColor: event.color }]}>
          <Text style={styles.coverEmoji}>{event.emoji}</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={[styles.recapLine, { color: colors.green600 }]}>Ai fost la</Text>
        <Text style={[styles.cardTitle, { color: theme.textPrimary }]} numberOfLines={1}>{event.title}</Text>
        <Text style={[styles.meta, { color: theme.textSecondary }]}>{formatDate(event)}</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="people-outline" size={13} color={theme.textSecondary} />
            <Text style={[styles.statText, { color: theme.textSecondary }]}>{attendeeCount}</Text>
          </View>
          {photoCount > 0 && (
            <View style={styles.stat}>
              <Ionicons name="image-outline" size={13} color={theme.textSecondary} />
              <Text style={[styles.statText, { color: theme.textSecondary }]}>{photoCount}</Text>
            </View>
          )}
        </View>
      </View>
    </AnimatedPressable>
  );
}

export default function Memories() {
  const { colors: theme } = useAppTheme();
  const { events, loading: eventsLoading, refresh } = useEvents();
  const { user } = useUser();
  const [attendedIds, setAttendedIds] = useState<string[]>([]);
  const [recaps, setRecaps] = useState<Recap[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMemories = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const ids = await getRecentAttendedEventIds(user.id, 200);
    setAttendedIds(ids);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadMemories();
    }, [loadMemories]),
  );

  const pastAttended = useMemo(() => {
    const idSet = new Set(attendedIds);
    const now = Date.now();
    return events
      .filter((event) => idSet.has(event.id) && event.startsAt && new Date(event.startsAt).getTime() < now)
      .sort((a, b) => new Date(b.startsAt!).getTime() - new Date(a.startsAt!).getTime());
  }, [events, attendedIds]);

  // Recap stats are fetched once the underlying event list settles, in
  // parallel per event — this screen is a personal history, not a live feed,
  // so it doesn't need realtime counts the way the event detail page does.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (pastAttended.length === 0) {
        setRecaps([]);
        return;
      }
      (async () => {
        const results = await Promise.all(
          pastAttended.map(async (event) => {
            const [attendeeCount, photos] = await Promise.all([getEventAttendeeCount(event.id), getEventPhotos(event.id)]);
            const coverUrl = photos[0] ? await getSignedEventPhotoUrl(photos[0].path) : null;
            return { event, attendeeCount, photoCount: photos.length, coverUrl };
          }),
        );
        if (!cancelled) setRecaps(results);
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pastAttended.map((e) => e.id).join(',')]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refresh(), loadMemories()]);
    setRefreshing(false);
  }

  const isLoading = loading || eventsLoading;

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
        <Text style={[styles.title, { color: theme.textPrimary }]}>Amintiri</Text>
        <View style={styles.backButton} />
      </View>

      {isLoading ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.green500} />
        </View>
      ) : pastAttended.length === 0 ? (
        <View style={styles.state}>
          <Ionicons name="images-outline" size={34} color={theme.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            După ce participi la un eveniment, va apărea aici ca amintire.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.green500} />}
          showsVerticalScrollIndicator={false}
        >
          {(recaps.length ? recaps : pastAttended.map((event) => ({ event, attendeeCount: 0, photoCount: 0, coverUrl: null }))).map(
            (recap) => (
              <RecapCard key={recap.event.id} recap={recap} />
            ),
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
  content: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  emptyText: { fontSize: 13, textAlign: 'center' },
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden', marginBottom: spacing.md },
  cover: { width: '100%', height: 120 },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  coverEmoji: { fontSize: 40 },
  cardBody: { padding: 13, gap: 3 },
  recapLine: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  meta: { fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 14, marginTop: 4 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 11, fontWeight: '700' },
});
