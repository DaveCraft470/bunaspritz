import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { FriendPrefsModal } from '@/components/social/FriendPrefsModal';
import { FriendPrefs, Profile, getFriendPrefs, getMutualFriends, setFriendPrefs } from '@/lib/social';

export default function Friends() {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const { user } = useUser();

  const [friends, setFriends] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuFor, setMenuFor] = useState<Profile | null>(null);
  const [prefs, setPrefs] = useState<FriendPrefs>({ mute_messages: false, mute_activity: false, hide_activity_from: false });

  useEffect(() => {
    if (!user) return;
    getMutualFriends(user.id).then((list) => {
      setFriends(list);
      setLoading(false);
    });
  }, [user]);

  async function openMenu(friend: Profile) {
    if (!user) return;
    light();
    setMenuFor(friend);
    setPrefs(await getFriendPrefs(user.id, friend.id));
  }

  async function updatePref(patch: Partial<FriendPrefs>) {
    if (!user || !menuFor) return;
    light();
    setPrefs((current) => ({ ...current, ...patch }));
    await setFriendPrefs(user.id, menuFor.id, patch);
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
        <Text style={[styles.title, { color: theme.textPrimary }]}>Prieteni</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!loading && friends.length === 0 && (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Încă nu ai prieteni — cei pe care îi urmărești și te urmăresc înapoi apar aici.
          </Text>
        )}

        {friends.map((friend) => (
          <AnimatedPressable
            key={friend.id}
            onPress={() => router.push(`/user/${friend.id}`)}
            style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={[styles.avatar, { backgroundColor: theme.surfaceMuted }]}>
              <Text style={[styles.avatarLetter, { color: theme.textPrimary }]}>
                {friend.name.trim().charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.name, { color: theme.textPrimary }]} numberOfLines={1}>
                {friend.name}
              </Text>
              <Text style={[styles.username, { color: theme.textSecondary }]} numberOfLines={1}>
                @{friend.username}
              </Text>
            </View>
            <AnimatedPressable
              onPress={() => openMenu(friend)}
              hitSlop={10}
              style={styles.menuButton}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={theme.textSecondary} />
            </AnimatedPressable>
          </AnimatedPressable>
        ))}
      </ScrollView>

      <FriendPrefsModal
        visible={!!menuFor}
        friendName={menuFor?.name ?? ''}
        prefs={prefs}
        onChange={updatePref}
        onClose={() => setMenuFor(null)}
      />
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
    paddingBottom: spacing.md,
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
  content: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  emptyText: { fontSize: 13, fontStyle: 'italic', paddingVertical: 20, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 18, fontWeight: '800' },
  rowText: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700' },
  username: { fontSize: 11, marginTop: 2 },
  menuButton: { padding: 6 },
});
