import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { Avatar } from '@/components/common/Avatar';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { showAlert } from '@/lib/alert';
import {
  GamificationStats,
  LeaderboardEntry,
  MISSIONS,
  claimMission,
  getClaimedMissionIds,
  getGamificationStats,
  getLeaderboard,
} from '@/lib/gamification';

// Mirrors xp_to_level()'s (N-1)^2 * 50 curve, so the progress bar can show
// "how far into this level" without a round-trip — level itself still
// always comes from the server (get_gamification_stats), this only
// recomputes the two thresholds around it.
function xpForLevel(level: number) {
  return (level - 1) ** 2 * 50;
}

function LevelHeader({ stats }: { stats: GamificationStats }) {
  const { colors: theme } = useAppTheme();
  const currentFloor = xpForLevel(stats.level);
  const nextFloor = xpForLevel(stats.level + 1);
  const progress = nextFloor > currentFloor ? Math.min(1, (stats.xp - currentFloor) / (nextFloor - currentFloor)) : 1;

  return (
    <View style={[styles.headerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.levelRow}>
        <View style={styles.levelBadge}>
          <Text style={styles.levelBadgeText}>Nivel {stats.level}</Text>
        </View>
        <View style={styles.streakBadge}>
          <Ionicons name="flame" size={15} color="#F5A623" />
          <Text style={[styles.streakText, { color: theme.textPrimary }]}>{stats.currentStreak} zile</Text>
        </View>
      </View>
      <Text style={[styles.xpText, { color: theme.textSecondary }]}>{stats.xp} XP</Text>
      <View style={[styles.progressTrack, { backgroundColor: theme.surfaceMuted }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={[styles.progressHint, { color: theme.textSecondary }]}>
        {nextFloor - stats.xp > 0 ? `${nextFloor - stats.xp} XP până la nivelul ${stats.level + 1}` : 'Nivel maxim atins'}
      </Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="map-outline" size={15} color={colors.green500} />
          <Text style={[styles.statText, { color: theme.textPrimary }]}>{stats.distinctLocations} locații explorate</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="trophy-outline" size={15} color={colors.green500} />
          <Text style={[styles.statText, { color: theme.textPrimary }]}>Recordul: {stats.longestStreak} zile</Text>
        </View>
      </View>
    </View>
  );
}

export default function Gamification() {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const { user } = useUser();
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [gamificationStats, claimed, board] = await Promise.all([
      getGamificationStats(user.id),
      getClaimedMissionIds(),
      getLeaderboard(),
    ]);
    setStats(gamificationStats);
    setClaimedIds(claimed);
    setLeaderboard(board);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleClaim(missionId: string, xp: number) {
    if (claimingId) return;
    light();
    setClaimingId(missionId);
    const ok = await claimMission(missionId);
    setClaimingId(null);
    if (ok) {
      setClaimedIds((current) => new Set(current).add(missionId));
      const gamificationStats = user ? await getGamificationStats(user.id) : null;
      if (gamificationStats) setStats(gamificationStats);
      showAlert('Misiune completă! 🎉', `Ai primit ${xp} XP.`);
    } else {
      showAlert('Nu încă', 'Nu îndeplinești încă toate condițiile pentru această misiune.');
    }
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
        <Text style={[styles.title, { color: theme.textPrimary }]}>Progres</Text>
        <View style={styles.backButton} />
      </View>

      {loading || !stats ? (
        <ActivityIndicator color={colors.green500} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green500} />}
        >
          <LevelHeader stats={stats} />

          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Misiuni săptămânale</Text>
          {MISSIONS.filter((m) => m.period === 'week').map((mission) => (
            <MissionRow
              key={mission.id}
              mission={mission}
              claimed={claimedIds.has(mission.id)}
              claiming={claimingId === mission.id}
              onClaim={() => handleClaim(mission.id, mission.xp)}
            />
          ))}

          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Provocări lunare</Text>
          {MISSIONS.filter((m) => m.period === 'month').map((mission) => (
            <MissionRow
              key={mission.id}
              mission={mission}
              claimed={claimedIds.has(mission.id)}
              claiming={claimingId === mission.id}
              onClaim={() => handleClaim(mission.id, mission.xp)}
            />
          ))}

          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Clasament</Text>
          {leaderboard.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Clasamentul se populează pe măsură ce oamenii strâng XP.</Text>
          ) : (
            leaderboard.map((entry, index) => (
              <AnimatedPressable
                key={entry.userId}
                onPress={() => router.push(`/user/${entry.userId}`)}
                style={[
                  styles.leaderRow,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  entry.userId === user?.id && { borderColor: colors.green500, borderWidth: 1.5 },
                ]}
              >
                <Text style={[styles.leaderRank, { color: theme.textSecondary }]}>{index + 1}</Text>
                <Avatar uri={entry.avatarUrl} name={entry.name} size={36} fontSize={14} />
                <View style={styles.leaderCopy}>
                  <Text style={[styles.leaderName, { color: theme.textPrimary }]} numberOfLines={1}>{entry.name}</Text>
                  <Text style={[styles.leaderMeta, { color: theme.textSecondary }]}>Nivel {entry.level}</Text>
                </View>
                <Text style={[styles.leaderXp, { color: colors.green500 }]}>{entry.xp} XP</Text>
              </AnimatedPressable>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function MissionRow({
  mission,
  claimed,
  claiming,
  onClaim,
}: {
  mission: (typeof MISSIONS)[number];
  claimed: boolean;
  claiming: boolean;
  onClaim: () => void;
}) {
  const { colors: theme } = useAppTheme();
  return (
    <View style={[styles.missionRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.missionCopy}>
        <Text style={[styles.missionTitle, { color: theme.textPrimary }]}>{mission.title}</Text>
        <Text style={[styles.missionDetail, { color: theme.textSecondary }]}>{mission.detail}</Text>
        <Text style={[styles.missionXp, { color: colors.green600 }]}>+{mission.xp} XP</Text>
      </View>
      <AnimatedPressable
        onPress={onClaim}
        disabled={claimed || claiming}
        style={[
          styles.claimButton,
          claimed ? { backgroundColor: theme.surfaceMuted } : { backgroundColor: colors.green500, opacity: claiming ? 0.6 : 1 },
        ]}
      >
        <Text style={[styles.claimButtonText, { color: claimed ? theme.textSecondary : colors.white }]}>
          {claimed ? 'Luat ✓' : claiming ? '...' : 'Revendică'}
        </Text>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 60 },
  headerCard: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 8, marginBottom: spacing.lg },
  levelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  levelBadge: { backgroundColor: colors.green500, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  levelBadgeText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  streakText: { fontSize: 13, fontWeight: '800' },
  xpText: { fontSize: 13, fontWeight: '700' },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.green500, borderRadius: 4 },
  progressHint: { fontSize: 11, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { fontSize: 11, fontWeight: '700' },
  sectionTitle: { fontSize: 14, fontWeight: '800', marginBottom: spacing.sm, marginTop: spacing.sm },
  missionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, padding: 13, marginBottom: spacing.sm },
  missionCopy: { flex: 1, gap: 2 },
  missionTitle: { fontSize: 13, fontWeight: '800' },
  missionDetail: { fontSize: 11, lineHeight: 15 },
  missionXp: { fontSize: 11, fontWeight: '900', marginTop: 2 },
  claimButton: { minHeight: 38, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  claimButtonText: { fontSize: 11, fontWeight: '800' },
  emptyText: { fontSize: 12, fontStyle: 'italic', paddingVertical: 10 },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 10, marginBottom: spacing.sm },
  leaderRank: { width: 20, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  leaderCopy: { flex: 1, minWidth: 0 },
  leaderName: { fontSize: 13, fontWeight: '800' },
  leaderMeta: { fontSize: 10, marginTop: 1 },
  leaderXp: { fontSize: 12, fontWeight: '900' },
});
