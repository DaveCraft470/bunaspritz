import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { spacing } from '@/constants/theme';
import { SpritzEvent } from '@/constants/events';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';

// Shared horizontal-scroll section for Discover's Last Minute / Trending /
// Recently Viewed rows — same "title + horizontal ScrollView" shape as
// StoriesRow (components/stories/StoriesRow.tsx), just with compact event
// cards instead of story bubbles. `getMeta` lets each section show its own
// secondary line (time-to-start, join count, etc.) under the same card.
export function EventRow({
  title,
  events,
  getMeta,
}: {
  title: string;
  events: SpritzEvent[];
  getMeta?: (event: SpritzEvent) => string | null;
}) {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();

  if (!events.length) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {events.map((event) => (
          <AnimatedPressable
            key={event.id}
            onPress={() => {
              light();
              router.push(`/event/${event.id}`);
            }}
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={[styles.icon, { backgroundColor: event.color }]}>
              <Text style={styles.emoji}>{event.emoji}</Text>
            </View>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]} numberOfLines={1}>
              {event.title}
            </Text>
            {getMeta?.(event) ? (
              <Text style={[styles.cardMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                {getMeta(event)}
              </Text>
            ) : null}
          </AnimatedPressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: spacing.md },
  title: { fontSize: 14, fontWeight: '800', marginBottom: spacing.sm },
  row: { gap: spacing.sm, paddingRight: spacing.lg },
  card: { width: 132, borderRadius: 16, borderWidth: 1, padding: 11, gap: 6 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 19 },
  cardTitle: { fontSize: 13, fontWeight: '800' },
  cardMeta: { fontSize: 10, fontWeight: '600' },
});
