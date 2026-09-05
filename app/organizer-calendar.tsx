import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useEvents } from '@/contexts/EventsContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { SpritzEvent } from '@/constants/events';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { addMonths, dateKey, formatMonth, getMonthGrid, isSameDay } from '@/lib/calendar';

function eventDate(event: SpritzEvent) {
  return event.startsAt ? new Date(event.startsAt) : null;
}

function EventRow({ event, onPress }: { event: SpritzEvent; onPress: () => void }) {
  const { colors: theme } = useAppTheme();
  const date = eventDate(event);

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
        <Text style={[styles.eventTime, { color: theme.textSecondary }]}>
          {date ? date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) : 'Oră în curs de stabilire'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </AnimatedPressable>
  );
}

function DayCell({
  date,
  inCurrentMonth,
  hasEvents,
  selected,
  onPress,
}: {
  date: Date;
  inCurrentMonth: boolean;
  hasEvents: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors: theme } = useAppTheme();

  return (
    <View style={styles.dayCell}>
      <AnimatedPressable
        onPress={onPress}
        style={[styles.dayButton, selected && { backgroundColor: colors.green500 }]}
      >
        <Text style={[styles.dayText, { color: !inCurrentMonth ? theme.border : selected ? colors.white : theme.textPrimary }]}>
          {date.getDate()}
        </Text>
        {hasEvents && <View style={[styles.eventDot, { backgroundColor: selected ? colors.white : colors.green500 }]} />}
      </AnimatedPressable>
    </View>
  );
}

export default function OrganizerCalendar() {
  const { colors: theme } = useAppTheme();
  const { events, loading: eventsLoading, error: eventsError, refresh } = useEvents();
  const { user } = useUser();
  const { light } = useHaptics();
  const hostedEvents = useMemo(
    () => (user ? events.filter((event) => event.hostId === user.id) : []),
    [events, user]
  );
  const datedEvents = useMemo(
    () => hostedEvents.filter((event) => event.startsAt !== null),
    [hostedEvents]
  );
  const initialMonth = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);
  const [month, setMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const eventDates = useMemo(
    () => new Set(datedEvents.map((event) => dateKey(new Date(event.startsAt as string)))),
    [datedEvents]
  );
  const weeks = useMemo(() => {
    const days = getMonthGrid(month);
    return Array.from({ length: 6 }, (_, weekIndex) => days.slice(weekIndex * 7, weekIndex * 7 + 7));
  }, [month]);
  const monthKeys = useMemo(
    () => datedEvents.map((event) => new Date(event.startsAt as string)).map((date) => date.getFullYear() * 12 + date.getMonth()),
    [datedEvents]
  );
  const currentMonthKey = month.getFullYear() * 12 + month.getMonth();
  const minimumMonthKey = Math.min(...monthKeys, currentMonthKey - 12);
  const maximumMonthKey = Math.max(...monthKeys, currentMonthKey + 12);
  const selectedEvents = datedEvents.filter((event) => isSameDay(new Date(event.startsAt as string), selectedDate));

  useEffect(() => {
    setSelectedDate(new Date(month.getFullYear(), month.getMonth(), 1));
  }, [month]);

  function moveMonth(amount: number) {
    const next = addMonths(month, amount);
    const nextKey = next.getFullYear() * 12 + next.getMonth();
    if (nextKey < minimumMonthKey || nextKey > maximumMonthKey) return;
    setMonth(next);
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
          <Ionicons name="chevron-back" size={20} color={glassButton.icon} />
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Calendar organizator</Text>
        <View style={styles.backButton} />
      </View>

      {eventsLoading ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.green500} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Se încarcă evenimentele...</Text>
        </View>
      ) : eventsError ? (
        <View style={styles.state}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Nu am putut încărca evenimentele.</Text>
          <AnimatedPressable onPress={() => void refresh()} style={[styles.retryButton, { borderColor: theme.border }]}>
            <Text style={[styles.retryText, { color: theme.textPrimary }]}>Reîncearcă</Text>
          </AnimatedPressable>
        </View>
      ) : (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
          <View style={styles.weekdayRow}>
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => (
              <Text key={`${day}-${index}`} style={[styles.weekday, { color: theme.textSecondary }]}>{day}</Text>
            ))}
          </View>
          <View style={styles.grid}>
            {weeks.map((week, weekIndex) => (
              <View key={`week-${weekIndex}`} style={styles.weekRow}>
                {week.map(({ date, key, inCurrentMonth }) => {
                  const hasEvents = eventDates.has(key);
                  const selected = isSameDay(date, selectedDate);
                  return (
                    <DayCell
                      key={key}
                      date={date}
                      inCurrentMonth={inCurrentMonth}
                      hasEvents={hasEvents}
                      selected={selected}
                      onPress={() => {
                        if (!inCurrentMonth) return;
                        light();
                        setSelectedDate(date);
                      }}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
          {selectedDate.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
        {selectedEvents.length ? (
          selectedEvents.map((event) => (
            <EventRow key={event.id} event={event} onPress={() => router.push(`/event/${event.id}`)} />
          ))
        ) : (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Nu există evenimente în această zi.</Text>
        )}
      </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 120 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  calendarCard: { borderRadius: 18, borderWidth: 1, padding: 14 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  arrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontSize: 17, fontWeight: '800', textTransform: 'capitalize' },
  weekdayRow: { flexDirection: 'row', marginBottom: 5 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '800' },
  grid: { width: '100%' },
  weekRow: { flexDirection: 'row', width: '100%', minWidth: 0, maxWidth: '100%' },
  dayCell: { flex: 1, minWidth: 0, maxWidth: '14.2857%', alignItems: 'center' },
  dayButton: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  dayText: { fontSize: 13, fontWeight: '700' },
  eventDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginTop: 22, marginBottom: 10, textTransform: 'capitalize' },
  eventCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: 16, borderWidth: 1, padding: 13, marginBottom: spacing.sm },
  eventIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  eventEmoji: { fontSize: 23 },
  eventCopy: { flex: 1 },
  eventTitle: { fontSize: 15, fontWeight: '800' },
  eventTime: { fontSize: 11, marginTop: 4 },
  emptyText: { textAlign: 'center', fontSize: 14, paddingVertical: spacing.xl },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  retryButton: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { fontSize: 13, fontWeight: '800' },
});
