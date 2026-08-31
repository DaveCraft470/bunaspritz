import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { GlassSurface } from '@/components/common/GlassSurface';
import { FriendPrefsModal } from '@/components/social/FriendPrefsModal';
import {
  FollowStatus,
  FriendPrefs,
  Profile,
  follow,
  getFollowStatus,
  getFriendPrefs,
  getProfile,
  setFriendPrefs,
  unfollow,
} from '@/lib/social';

export default function PublicProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const { user } = useUser();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<FollowStatus>({ iFollow: false, followsMe: false, mutual: false });
  const [prefs, setPrefs] = useState<FriendPrefs>({ mute_messages: false, mute_activity: false, hide_activity_from: false });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    getProfile(id).then(setProfile);
    getFollowStatus(user.id, id).then(setStatus);
    getFriendPrefs(user.id, id).then(setPrefs);
  }, [user, id]);

  async function toggleFollow() {
    if (!user || !id) return;
    light();
    if (status.iFollow) {
      setStatus((s) => ({ ...s, iFollow: false, mutual: false }));
      await unfollow(user.id, id);
    } else {
      setStatus((s) => ({ ...s, iFollow: true, mutual: s.followsMe }));
      await follow(user.id, id);
    }
  }

  async function updatePref(patch: Partial<FriendPrefs>) {
    if (!user || !id) return;
    light();
    setPrefs((current) => ({ ...current, ...patch }));
    await setFriendPrefs(user.id, id, patch);
  }

  if (!profile) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
        <StatusBar style={theme.statusBar} />
      </SafeAreaView>
    );
  }

  const followLabel = status.iFollow ? 'Urmăresc' : status.followsMe ? 'Urmărește înapoi' : 'Urmărește';

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
        <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>
          @{profile.username}
        </Text>
        <AnimatedPressable
          onPress={() => {
            light();
            setMenuOpen(true);
          }}
          hitSlop={10}
          accessibilityLabel="Mai multe opțiuni"
          style={[styles.backButton, shadows.soft, { borderColor: glassButton.border }]}
        >
          <GlassSurface />
          <Ionicons name="ellipsis-horizontal" size={20} color={glassButton.icon} />
        </AnimatedPressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={[styles.avatar, { borderColor: theme.surface }]}>
            <Text style={styles.avatarText}>{profile.name.trim().charAt(0).toUpperCase() || '?'}</Text>
          </View>
          <Text style={[styles.name, { color: theme.textPrimary }]}>{profile.name}</Text>
          <Text style={[styles.handle, { color: theme.textSecondary }]}>@{profile.username}</Text>
          {profile.bio ? <Text style={[styles.bio, { color: theme.textSecondary }]}>{profile.bio}</Text> : null}
        </View>

        <View style={styles.actionsRow}>
          <AnimatedPressable
            onPress={toggleFollow}
            style={[
              styles.actionButton,
              status.iFollow
                ? { backgroundColor: theme.surfaceMuted, borderColor: theme.border, borderWidth: 1 }
                : { backgroundColor: colors.green500 },
            ]}
          >
            <Text style={[styles.actionText, { color: status.iFollow ? theme.textPrimary : colors.white }]}>
              {followLabel}
            </Text>
          </AnimatedPressable>

          <AnimatedPressable
            onPress={() => status.mutual && router.push({ pathname: '/messages', params: { friendId: id } })}
            disabled={!status.mutual}
            style={[
              styles.actionButton,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border, borderWidth: 1, opacity: status.mutual ? 1 : 0.5 },
            ]}
          >
            <Text style={[styles.actionText, { color: theme.textPrimary }]}>Mesaj</Text>
          </AnimatedPressable>
        </View>

        {!status.mutual && (
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            Puteți să vă trimiteți mesaje doar dacă vă urmăriți reciproc.
          </Text>
        )}
      </ScrollView>

      <FriendPrefsModal
        visible={menuOpen}
        friendName={profile.name}
        prefs={prefs}
        onChange={updatePref}
        onClose={() => setMenuOpen(false)}
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
    gap: spacing.md,
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
  title: { fontSize: 15, fontWeight: '800', flex: 1, textAlign: 'center' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 40, alignItems: 'center' },
  header: { alignItems: 'center', marginTop: 10, marginBottom: 22 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 30,
    backgroundColor: '#12C854',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    marginBottom: 14,
  },
  avatarText: { color: '#FFFFFF', fontSize: 34, fontWeight: '800' },
  name: { fontSize: 21, fontWeight: '800' },
  handle: { fontSize: 13, marginTop: 3 },
  bio: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 12, maxWidth: 320 },
  actionsRow: { flexDirection: 'row', gap: 10, width: '100%', maxWidth: 360 },
  actionButton: { flex: 1, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 14, fontWeight: '800' },
  hint: { fontSize: 11, fontStyle: 'italic', marginTop: 14, textAlign: 'center', maxWidth: 300 },
});
