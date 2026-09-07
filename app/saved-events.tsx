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
import { useLanguage } from '@/contexts/LanguageContext';
import { useUser } from '@/contexts/UserContext';
import { getSavedEventIds } from '@/lib/savedEvents';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';

function formatDate(event: SpritzEvent, locale: string) {
  if (!event.startsAt) return null;
  const date = new Date(event.startsAt);
  return `${date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })} · ${date.toLocaleTimeString(
    locale,
    { hour: '2-digit', minute: '2-digit' },
  )}`;
}

function EventCard({ event, locale }: { event: SpritzEvent; locale: string }) {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();

  return (
    <AnimatedPressable
      onPress={() => {
        light();
        router.push(`/event/${event.id}`);
      }}
      style={[styles.eventCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={[styles.eventIcon, { backgroundColor: event.color }]}>
        <Text style={styles.eventEmoji}>{event.emoji}</Text>
      </View>
      <View style={styles.eventCopy}>
        <Text style={[styles.eventTitle, { color: theme.textPrimary }]} numberOfLines={1}>{event.title}</Text>
        {formatDate(event, locale) && (
          <Text style={[styles.eventMeta, { color: theme.textSecondary }]} numberOfLines={1}>
            {formatDate(event, locale)}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </AnimatedPressable>
  );
}

export default function SavedEvents() {
  const { colors: theme } = useAppTheme();
  const { t, locale } = useLanguage();
  const { events, loading: eventsLoading, error: eventsError, refresh } = useEvents();
  const { user } = useUser();
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadSaved = useCallback(async () => {
    if (!user) {
      setSavedLoading(false);
      return;
    }
    setSavedLoading(true);
    setSavedError(false);
    try {
      setSavedIds(await getSavedEventIds(user.id));
    } catch {
      setSavedError(true);
    } finally {
      setSavedLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadSaved();
    }, [loadSaved]),
  );

  const savedEvents = useMemo(() => {
    const order = new Map(savedIds.map((id, index) => [id, index]));
    return events.filter((event) => order.has(event.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  }, [events, savedIds]);

  const loading = eventsLoading || savedLoading;
  const error = eventsError || savedError;

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refresh(), loadSaved()]);
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />
      <View style={styles.topBar}>
        <AnimatedPressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityLabel={t.common.back}
          style={[styles.backButton, shadows.soft, { borderColor: glassButton.border }]}
        >
          <Ionicons name="chevron-back" size={20} color={glassButton.icon} />
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.textPrimary }]}>{t.savedEvents.title}</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.green500} />
          <Text style={[styles.stateText, { color: theme.textSecondary }]}>{t.savedEvents.loading}</Text>
        </View>
      ) : error ? (
        <View style={styles.state}>
          <Text style={[styles.stateText, { color: theme.textSecondary }]}>{t.savedEvents.couldNotLoad}</Text>
          <AnimatedPressable onPress={handleRefresh} style={[styles.retryButton, { backgroundColor: colors.green500 }]}>
            <Text style={styles.retryText}>{t.savedEvents.retry}</Text>
          </AnimatedPressable>
        </View>
      ) : savedEvents.length === 0 ? (
        <View style={styles.state}>
          <Ionicons name="bookmark-outline" size={34} color={theme.textSecondary} />
          <Text style={[styles.stateText, { color: theme.textSecondary }]}>{t.savedEvents.empty}</Text>
          <AnimatedPressable onPress={() => router.push('/discover')} style={[styles.retryButton, { backgroundColor: colors.green500 }]}>
            <Text style={styles.retryText}>{t.savedEvents.exploreButton}</Text>
          </AnimatedPressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.green500} />}
          showsVerticalScrollIndicator={false}
        >
          {savedEvents.map((event) => <EventCard key={event.id} event={event} locale={locale} />)}
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
