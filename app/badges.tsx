import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { GlassSurface } from '@/components/common/GlassSurface';
import { getFriends } from '@/lib/friendRequests';
import { getUserEventStats } from '@/lib/events';
import { BADGES, BadgeStats } from '@/lib/badges';

export default function Badges() {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const { user, effectiveVerified } = useUser();
  const [stats, setStats] = useState<BadgeStats>({ attended: 0, hosted: 0, friends: 0, verified: false });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [friends, eventStats] = await Promise.all([getFriends(user.id), getUserEventStats(user.id)]);
    setStats({ attended: eventStats.attended, hosted: eventStats.hosted, friends: friends.length, verified: effectiveVerified });
  }, [user, effectiveVerified]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const earned = BADGES.filter((badge) => badge.unlocked(stats));
  const locked = BADGES.filter((badge) => !badge.unlocked(stats));

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
        <Text style={[styles.title, { color: theme.textPrimary }]}>Trofee</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green500} />}
      >
        <Text style={[styles.summary, { color: theme.textSecondary }]}>
          Ai obținut {earned.length} din {BADGES.length} trofee.
        </Text>

        {earned.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.textPrimary }]}>Obținute</Text>
            <View style={styles.grid}>
              {earned.map((badge) => (
                <View
                  key={badge.id}
                  style={[styles.card, { backgroundColor: theme.surface, borderColor: colors.green500 }]}
                >
                  <View style={[styles.iconCircle, { backgroundColor: theme.surfaceMuted }]}>
                    <Text style={styles.emoji}>{badge.emoji}</Text>
                  </View>
                  <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{badge.title}</Text>
                  <View style={styles.earnedTag}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.green500} />
                    <Text style={[styles.earnedTagText, { color: colors.green500 }]}>Obținut</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={[styles.sectionLabel, { color: theme.textPrimary }]}>De obținut</Text>
        {locked.length === 0 ? (
          <Text style={[styles.rowDetail, { color: theme.textSecondary }]}>
            Le-ai obținut pe toate! Revino des, pot apărea trofee noi.
          </Text>
        ) : (
          <View style={{ gap: spacing.md }}>
            {locked.map((badge) => {
              const current = Math.min(badge.current(stats), badge.target ?? 1);
              const target = badge.target ?? 1;
              const progressPct = Math.round((current / target) * 100);
              return (
                <View key={badge.id} style={[styles.lockedCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={styles.lockedTop}>
                    <View style={[styles.iconCircle, styles.iconCircleLocked, { backgroundColor: theme.surfaceMuted }]}>
                      <Text style={[styles.emoji, styles.emojiLocked]}>{badge.emoji}</Text>
                    </View>
                    <View style={styles.lockedCopy}>
                      <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{badge.title}</Text>
                      <Text style={[styles.rowDetail, { color: theme.textSecondary }]}>{badge.howTo}</Text>
                    </View>
                  </View>
                  {badge.target !== null && (
                    <View style={styles.progressRow}>
                      <View style={[styles.progressTrack, { backgroundColor: theme.surfaceMuted }]}>
                        <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: colors.green500 }]} />
                      </View>
                      <Text style={[styles.progressText, { color: theme.textSecondary }]}>
                        {current}/{target}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
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
  title: { fontSize: 18, fontWeight: '800' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.huge },
  summary: { fontSize: 13, marginBottom: spacing.lg },
  sectionLabel: { fontSize: 15, fontWeight: '800', marginBottom: spacing.md, marginTop: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl },
  card: {
    width: '47%',
    borderRadius: 18,
    borderWidth: 1.5,
    padding: spacing.md,
    alignItems: 'center',
  },
  iconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  iconCircleLocked: { opacity: 0.5 },
  emoji: { fontSize: 26 },
  emojiLocked: { opacity: 0.6 },
  cardTitle: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  earnedTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  earnedTagText: { fontSize: 10, fontWeight: '800' },
  lockedCard: { borderRadius: 18, borderWidth: 1, padding: spacing.lg },
  lockedTop: { flexDirection: 'row', gap: spacing.md },
  lockedCopy: { flex: 1, justifyContent: 'center' },
  rowDetail: { fontSize: 12, marginTop: 3, lineHeight: 16 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 11, fontWeight: '700' },
});
