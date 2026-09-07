import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Reanimated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { useEvents } from '@/contexts/EventsContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { GlassSurface } from '@/components/common/GlassSurface';
import { getBadgeDefinition, getUserBadges, type EarnedBadge } from '@/lib/badges';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function BadgeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const { user } = useUser();
  const { events } = useEvents();
  const [earned, setEarned] = useState<EarnedBadge | null>(null);
  const [loading, setLoading] = useState(true);

  const definition = id ? getBadgeDefinition(id) : undefined;
  const linkedEvent = earned?.eventId ? events.find((event) => event.id === earned.eventId) : undefined;

  useEffect(() => {
    if (!user || !id) return;
    setLoading(true);
    getUserBadges(user.id)
      .then((badges) => setEarned(badges.find((badge) => badge.badgeId === id) ?? null))
      .finally(() => setLoading(false));
  }, [user, id]);

  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 6000, easing: Easing.linear }), -1, false);
  }, [rotation]);
  const rotationStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  if (!definition) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
        <Text style={[styles.notFound, { color: theme.textSecondary }]}>Trofeu inexistent.</Text>
      </SafeAreaView>
    );
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
        <View style={styles.backButton} />
      </View>

      <View style={styles.content}>
        <View style={[styles.iconRing, { borderColor: earned ? colors.green500 : theme.border }]}>
          <Reanimated.View style={rotationStyle}>
            <Text style={styles.emoji}>{definition.emoji}</Text>
          </Reanimated.View>
        </View>

        <Text style={[styles.title, { color: theme.textPrimary }]}>{definition.title}</Text>
        <Text style={[styles.description, { color: theme.textSecondary }]}>{definition.description}</Text>

        {loading ? null : earned ? (
          <View style={[styles.statusCard, { backgroundColor: theme.surface, borderColor: colors.green500 }]}>
            <View style={styles.statusRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.green500} />
              <Text style={[styles.statusText, { color: colors.green500 }]}>Obținut pe {formatDate(earned.earnedAt)}</Text>
            </View>
            {linkedEvent && (
              <AnimatedPressable
                onPress={() => {
                  light();
                  router.push(`/event/${linkedEvent.id}`);
                }}
                style={styles.linkedEventRow}
              >
                <Text style={[styles.linkedEventText, { color: theme.accent }]} numberOfLines={1}>
                  {linkedEvent.title}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={theme.accent} />
              </AnimatedPressable>
            )}
          </View>
        ) : (
          <View style={[styles.statusCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.howToLabel, { color: theme.textPrimary }]}>Cum îl obții</Text>
            <Text style={[styles.howToText, { color: theme.textSecondary }]}>{definition.howTo}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  iconRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emoji: { fontSize: 56 },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  description: { fontSize: 13, textAlign: 'center', marginTop: spacing.sm, lineHeight: 19 },
  statusCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1.5,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontSize: 13, fontWeight: '700' },
  linkedEventRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.md },
  linkedEventText: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  howToLabel: { fontSize: 13, fontWeight: '800', marginBottom: 6 },
  howToText: { fontSize: 12, lineHeight: 17 },
  notFound: { flex: 1, textAlign: 'center', textAlignVertical: 'center', fontSize: 14 },
});
