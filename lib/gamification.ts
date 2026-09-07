import { supabase } from '@/lib/supabase';

// XP is awarded entirely server-side via triggers on event_attendees/
// reviews/events (see the migration) — this file only ever reads state and
// calls claim_mission(); there's no direct XP-granting call for the client
// to make (and no insert/update policy on user_xp that would allow one).
export type GamificationStats = {
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  distinctLocations: number;
};

const EMPTY_STATS: GamificationStats = { xp: 0, level: 1, currentStreak: 0, longestStreak: 0, distinctLocations: 0 };

export async function getGamificationStats(userId: string): Promise<GamificationStats> {
  const { data, error } = await supabase.rpc('get_gamification_stats', { p_user_id: userId });
  const row = data?.[0];
  if (error || !row) return EMPTY_STATS;
  return {
    xp: row.xp,
    level: row.level,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    distinctLocations: row.distinct_locations,
  };
}

export type Mission = {
  id: string;
  title: string;
  detail: string;
  xp: number;
  period: 'week' | 'month';
};

// Catalog mirrors claim_mission()'s criteria exactly (see the migration) —
// this is display copy only, the server re-validates everything before
// awarding XP, so a stale/tampered client catalog can't grant XP it hasn't
// actually earned.
export const MISSIONS: Mission[] = [
  { id: 'weekly_checkin_3', title: 'Prezent la 3 evenimente', detail: 'Confirmă prezența (check-in) la 3 evenimente săptămâna aceasta.', xp: 50, period: 'week' },
  { id: 'weekly_review_1', title: 'Lasă o recenzie', detail: 'Lasă o recenzie unei persoane cu care ai fost la un eveniment săptămâna aceasta.', xp: 20, period: 'week' },
  { id: 'monthly_checkin_8', title: 'O lună plină', detail: 'Confirmă prezența la 8 evenimente luna aceasta.', xp: 150, period: 'month' },
  { id: 'monthly_host_1', title: 'Devino organizator', detail: 'Organizează cel puțin un eveniment luna aceasta.', xp: 100, period: 'month' },
];

// Scoped server-side to just the current week/month (see get_claimed_missions
// in the migration) — a mission_id here means "already claimed this period",
// full stop, no period-key math needed on this side.
export async function getClaimedMissionIds(): Promise<Set<string>> {
  const { data, error } = await supabase.rpc('get_claimed_missions');
  if (error || !data) return new Set();
  return new Set((data as { mission_id: string }[]).map((row) => row.mission_id));
}

export async function claimMission(missionId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('claim_mission', { p_mission_id: missionId });
  return !error && data === true;
}

export type LeaderboardEntry = { userId: string; name: string; username: string; avatarUrl: string | null; xp: number; level: number };

export async function getLeaderboard(city?: string | null, limit = 20): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_leaderboard', { p_city: city ?? null, p_limit: limit });
  if (error || !data) return [];
  return (data as { user_id: string; name: string; username: string; avatar_url: string | null; xp: number; level: number }[]).map((row) => ({
    userId: row.user_id,
    name: row.name,
    username: row.username,
    avatarUrl: row.avatar_url,
    xp: row.xp,
    level: row.level,
  }));
}
