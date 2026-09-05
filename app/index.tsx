import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { MapPlaceholder } from '@/components/home/MapPlaceholder';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useEvents } from '@/contexts/EventsContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { SpritzEvent } from '@/constants/events';
import { addMonths, dateKey, formatMonth, isSameDay, startOfDay } from '@/lib/calendar';
import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { getUserJoinedEventIds } from '@/lib/events';
import { getRecommendedEvents, RecommendedEvent } from '@/lib/recommendations';
import { useUser } from '@/contexts/UserContext';

function PublicEventRow({ event }: { event: SpritzEvent }) {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const startsAt = event.startsAt ? new Date(event.startsAt) : null;
  const entryFee = event.entryFeeRon === null ? null : event.entryFeeRon === 0 ? 'Gratis' : `${event.entryFeeRon} RON`;
  const participants = event.maxParticipants ? `Maxim ${event.maxParticipants} participanți` : null;

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
        <Text style={[styles.eventTitle, { color: theme.textPrimary }]} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={[styles.eventMeta, { color: theme.textSecondary }]}>
          {startsAt ? startsAt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) : 'Oră în curs de stabilire'}
          {event.genre ? ` · ${event.genre}` : ''}
        </Text>
        {(entryFee || participants) && (
          <Text style={[styles.eventMeta, { color: theme.textSecondary }]}>
            {[entryFee, participants].filter(Boolean).join(' · ')}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </AnimatedPressable>
  );
}

function RecommendationRow({ recommendation }: { recommendation: RecommendedEvent }) {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const startsAt = new Date(recommendation.event.startsAt!);

  return (
    <AnimatedPressable
      onPress={() => {
        light();
        router.push(`/event/${recommendation.event.id}`);
      }}
      style={[styles.eventCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={[styles.eventIcon, { backgroundColor: recommendation.event.color }]}>
        <Text style={styles.eventEmoji}>{recommendation.event.emoji}</Text>
      </View>
      <View style={styles.eventCopy}>
        <Text style={[styles.eventTitle, { color: theme.textPrimary }]} numberOfLines={1}>
          {recommendation.event.title}
        </Text>
        <Text style={[styles.eventMeta, { color: theme.textSecondary }]} numberOfLines={1}>
          {startsAt.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })} ·{' '}
          {startsAt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
          {recommendation.event.genre ? ` · ${recommendation.event.genre}` : ''}
        </Text>
        <Text style={[styles.recommendationReason, { color: colors.green500 }]}>{recommendation.reason}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </AnimatedPressable>
  );
}

function PublicCalendar({ onShowMap }: { onShowMap: () => void }) {
  const { colors: theme } = useAppTheme();
  const { events } = useEvents();
  const { light } = useHaptics();
  const daysRef = useRef<ScrollView>(null);
  const datedEvents = useMemo(() => events.filter((event) => event.startsAt != null), [events]);
  const DAY_ITEM_WIDTH = 62;
  const initialMonth = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);
  const [month, setMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const eventDates = useMemo(() => new Set(datedEvents.map((event) => dateKey(new Date(event.startsAt!)))), [datedEvents]);
  const monthKeys = useMemo(
    () => datedEvents.map((event) => new Date(event.startsAt!).getFullYear() * 12 + new Date(event.startsAt!).getMonth()),
    [datedEvents]
  );
  const currentMonthKey = month.getFullYear() * 12 + month.getMonth();
  const todayMonthKey = new Date().getFullYear() * 12 + new Date().getMonth();
  const minimumMonthKey = monthKeys.length ? Math.min(...monthKeys, todayMonthKey - 12) : todayMonthKey - 12;
  const maximumMonthKey = monthKeys.length ? Math.max(...monthKeys, todayMonthKey + 12) : todayMonthKey + 12;
  const daysInMonth = useMemo(
    () => Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1)),
    [month],
  );
  const selectedEvents = datedEvents.filter((event) => isSameDay(new Date(event.startsAt!), selectedDate));

  useEffect(() => {
    const today = startOfDay(new Date());
    const nextSelected = today.getFullYear() === month.getFullYear() && today.getMonth() === month.getMonth()
      ? today
      : daysInMonth[0];
    setSelectedDate(nextSelected);
    const selectedIndex = daysInMonth.findIndex((day) => isSameDay(day, nextSelected));
    if (selectedIndex >= 0) {
      const timer = setTimeout(() => daysRef.current?.scrollTo({ x: Math.max(0, selectedIndex * DAY_ITEM_WIDTH - 120), animated: true }), 0);
      return () => clearTimeout(timer);
    }
  }, [month, daysInMonth]);

  function moveMonth(amount: number) {
    const next = addMonths(month, amount);
    const nextKey = next.getFullYear() * 12 + next.getMonth();
    if (nextKey < minimumMonthKey || nextKey > maximumMonthKey) return;
    setMonth(next);
  }

  return (
    <SafeAreaView style={[styles.calendarSafeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />
      <View style={styles.calendarTopBar}>
        <Text style={[styles.calendarTitle, { color: theme.textPrimary }]}>Calendar public</Text>
        <AnimatedPressable
          onPress={() => {
            light();
            onShowMap();
          }}
          hitSlop={10}
          accessibilityLabel="Arată harta"
          style={[styles.modeButton, shadows.soft, { borderColor: glassButton.border }]}
        >
          <Ionicons name="map-outline" size={20} color={glassButton.icon} />
        </AnimatedPressable>
      </View>

      <ScrollView contentContainerStyle={styles.calendarContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.calendarCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.monthHeader}>
            <AnimatedPressable onPress={() => moveMonth(-1)} disabled={currentMonthKey <= minimumMonthKey} style={styles.arrow}>
              <Ionicons name="chevron-back" size={20} color={currentMonthKey <= minimumMonthKey ? theme.border : theme.textPrimary} />
            </AnimatedPressable>
            <Text style={[styles.monthTitle, { color: theme.textPrimary }]}>{formatMonth(month)}</Text>
            <AnimatedPressable onPress={() => moveMonth(1)} disabled={currentMonthKey >= maximumMonthKey} style={styles.arrow}>
              <Ionicons name="chevron-forward" size={20} color={currentMonthKey >= maximumMonthKey ? theme.border : theme.textPrimary} />
            </AnimatedPressable>
          </View>
          <ScrollView ref={daysRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysStrip}>
            {daysInMonth.map((date) => {
              const key = dateKey(date);
              const selected = isSameDay(date, selectedDate);
              const today = isSameDay(date, new Date());
              return (
                <AnimatedPressable
                  key={key}
                  onPress={() => {
                    light();
                    setSelectedDate(date);
                  }}
                  style={[styles.dayItem, selected && { backgroundColor: colors.green500 }]}
                >
                  <Text style={[styles.dayNumber, { color: selected ? colors.white : theme.textPrimary }]}>{date.getDate()}</Text>
                  <Text style={[styles.dayWeekday, { color: selected ? colors.white : theme.textSecondary }]}>
                    {date.toLocaleDateString('ro-RO', { weekday: 'short' }).replace('.', '')}
                  </Text>
                  {eventDates.has(key) && <View style={[styles.eventDot, { backgroundColor: selected ? colors.white : colors.green500 }]} />}
                  {today && !selected && <View style={[styles.todayIndicator, { backgroundColor: colors.green500 }]} />}
                </AnimatedPressable>
              );
            })}
          </ScrollView>
        </View>

        <Text style={[styles.selectedDateTitle, { color: theme.textPrimary }]}>
          {selectedDate.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
        {selectedEvents.length ? (
          selectedEvents.map((event) => <PublicEventRow key={event.id} event={event} />)
        ) : (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Nu există evenimente în această zi.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function Home() {
  const [view, setView] = useState<'map' | 'calendar'>('map');
  const { user } = useUser();
  const { events, loading: eventsLoading } = useEvents();
  const [joinedEventIds, setJoinedEventIds] = useState<Set<string>>(new Set());
  const [joinedLoading, setJoinedLoading] = useState(false);
  const [joinedError, setJoinedError] = useState(false);

  const loadJoinedEvents = useCallback(async () => {
    if (!user) {
      setJoinedEventIds(new Set());
      return;
    }
    setJoinedLoading(true);
    setJoinedError(false);
    try {
      setJoinedEventIds(new Set(await getUserJoinedEventIds(user.id)));
    } catch {
      setJoinedError(true);
    } finally {
      setJoinedLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadJoinedEvents();
    }, [loadJoinedEvents]),
  );

  const recommendations = useMemo(
    () => getRecommendedEvents(events, user?.id, { joinedEventIds }),
    [events, joinedEventIds, user?.id],
  );

  return (
    <View style={styles.root}>
      {view === 'map' ? (
        <>
          <MapPlaceholder onOpenCalendar={() => setView('calendar')} />
          <AnimatedPressable
            onPress={() => router.push('/discover')}
            style={styles.exploreButton}
            accessibilityLabel="Explorează evenimente"
          >
            <Ionicons name="compass-outline" size={18} color={colors.green700} />
            <Text style={styles.exploreButtonText}>Explorează</Text>
          </AnimatedPressable>
          <View style={styles.recommendationsPanel}>
            <Text style={styles.recommendationsTitle}>Pentru tine</Text>
            {eventsLoading || joinedLoading ? (
              <Text style={styles.recommendationsStatus}>Se încarcă recomandările...</Text>
            ) : joinedError ? (
              <Text style={styles.recommendationsStatus}>Recomandările nu sunt disponibile momentan.</Text>
            ) : recommendations.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendationsList}>
                {recommendations.map((recommendation) => (
                  <View key={recommendation.event.id} style={styles.recommendationItem}>
                    <RecommendationRow recommendation={recommendation} />
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.recommendationsStatus}>Nu avem momentan recomandări pentru tine.</Text>
            )}
          </View>
        </>
      ) : (
        <PublicCalendar onShowMap={() => setView('map')} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  calendarSafeArea: { flex: 1 },
  calendarTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  calendarTitle: { fontSize: 22, fontWeight: '800' },
  modeButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  calendarContent: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  calendarCard: { borderRadius: 18, borderWidth: 1, padding: 14 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  arrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontSize: 17, fontWeight: '800', textTransform: 'capitalize' },
  daysStrip: { paddingHorizontal: 4, gap: 8 },
  dayItem: { width: 54, minHeight: 70, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  dayNumber: { fontSize: 18, fontWeight: '800' },
  dayWeekday: { fontSize: 11, fontWeight: '700', marginTop: 2, textTransform: 'capitalize' },
  eventDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  todayIndicator: { width: 4, height: 4, borderRadius: 2, marginTop: 5 },
  selectedDateTitle: { fontSize: 18, fontWeight: '800', marginTop: 22, marginBottom: 10, textTransform: 'capitalize' },
  eventCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: 16, borderWidth: 1, padding: 13, marginBottom: spacing.sm },
  eventIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  eventEmoji: { fontSize: 23 },
  eventCopy: { flex: 1 },
  eventTitle: { fontSize: 15, fontWeight: '800' },
  eventMeta: { fontSize: 11, marginTop: 4 },
  emptyText: { textAlign: 'center', fontSize: 14, paddingVertical: spacing.xl },
  recommendationReason: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  recommendationsPanel: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: 28 },
  recommendationsTitle: { color: colors.white, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  recommendationsList: { gap: spacing.sm },
  recommendationItem: { width: 300 },
  recommendationsStatus: { color: colors.white, fontSize: 13, paddingVertical: 8 },
  exploreButton: {
    position: 'absolute',
    top: 112,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FBFEFC',
    borderColor: '#EAF7EF',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  exploreButtonText: { color: colors.green700, fontSize: 12, fontWeight: '800' },
});
