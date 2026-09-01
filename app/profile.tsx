import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { Avatar } from '@/components/common/Avatar';
import { InstagramLink } from '@/components/common/InstagramLink';
import { getMutualFriends } from '@/lib/social';
import { getUserEventStats } from '@/lib/events';

// Profile design by raulnitu8 — ported from App.tsx's ProfileScreen onto its
// own Expo Router screen, matching how app/messages.tsx was ported.

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { colors: theme } = useAppTheme();
  const { user } = useUser();
  const [friendCount, setFriendCount] = useState(0);
  const [eventStats, setEventStats] = useState({ attended: 0, hosted: 0 });

  useEffect(() => {
    if (!user) return;
    getMutualFriends(user.id).then((friends) => setFriendCount(friends.length));
    getUserEventStats(user.id).then(setEventStats);
  }, [user]);

  const name = user?.name || 'Utilizator';
  const username = user?.username || 'utilizator';
  const bio = user?.bio || 'Ieșiri bune, oameni faini și seri de ținut minte. ✨';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />
      <ScrollView
        style={[styles.profile, { backgroundColor: theme.page }]}
        contentContainerStyle={[styles.profileContent, { paddingBottom: insets.bottom + 116 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <Avatar
            uri={user?.avatarUrl}
            name={name}
            size={74}
            fontSize={32}
            color="#12C854"
            style={[styles.profileAvatar, { borderColor: theme.surface }]}
          />
          <View style={styles.profileTitleBlock}>
            <View style={styles.nameRow}>
              <Text style={[styles.profileName, { color: theme.textPrimary }]}>{name}</Text>
              {user?.verified && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>✓</Text>
                </View>
              )}
            </View>
            <Text style={[styles.profileHandle, { color: theme.textSecondary }]}>@{username}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/edit-profile')}
            style={[styles.editButton, { borderColor: theme.border }]}
          >
            <Text style={[styles.editText, { color: theme.accent }]}>Editează</Text>
          </Pressable>
        </View>

        <Text style={[styles.bio, { color: theme.textSecondary }]}>{bio}</Text>
        <InstagramLink handle={user?.instagramHandle} />

        <View style={[styles.statsRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Pressable style={styles.stat} onPress={() => router.push('/friends')}>
            <Text style={[styles.statNumber, { color: theme.textPrimary }]}>{friendCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Prieteni</Text>
          </Pressable>
          <View style={styles.stat}>
            <Text style={[styles.statNumber, { color: theme.textPrimary }]}>{eventStats.attended}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Evenimente</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statNumber, { color: theme.textPrimary }]}>{eventStats.hosted}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Găzduite</Text>
          </View>
        </View>

        <Pressable
          onPress={() => {
            if (!user?.verified) {
              router.push({ pathname: '/verification', params: { returnTo: '/profile' } });
            }
          }}
          style={[styles.verifyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <View style={[styles.verifyIcon, { backgroundColor: theme.surfaceMuted }]}>
            <Text style={[styles.verifyIconText, { color: theme.accent }]}>✓</Text>
          </View>
          <View style={styles.verifyCopy}>
            <Text style={[styles.verifyTitle, { color: theme.textPrimary }]}>
              {user?.verified ? 'Identitate verificată' : 'Verificare identitate'}
            </Text>
            <Text style={[styles.verifyDetail, { color: theme.textSecondary }]}>
              {user?.verified
                ? 'Contul tău a trecut de verificarea 18+.'
                : 'Necesară pentru a te alătura unui Spritz.'}
            </Text>
          </View>
          {!user?.verified && <Text style={[styles.verifyArrow, { color: theme.accent }]}>›</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  profile: { flex: 1 },
  profileContent: { padding: 22 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileAvatar: { width: 74, height: 74, borderRadius: 27, borderWidth: 3 },
  profileTitleBlock: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  profileName: { fontSize: 21, fontWeight: '800', letterSpacing: -0.4 },
  verifiedBadge: { width: 19, height: 19, borderRadius: 10, backgroundColor: '#12C854', alignItems: 'center', justifyContent: 'center' },
  verifiedText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  profileHandle: { fontSize: 12, marginTop: 3 },
  editButton: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  editText: { fontSize: 11, fontWeight: '800' },
  bio: { fontSize: 14, lineHeight: 20, marginTop: 20, marginBottom: 18 },
  statsRow: { flexDirection: 'row', marginVertical: 16, borderRadius: 16, borderWidth: 1 },
  stat: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  statNumber: { fontSize: 19, fontWeight: '800' },
  statLabel: { fontSize: 10, marginTop: 3, fontWeight: '700' },
  verifyCard: { marginTop: 22, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 17, borderWidth: 1 },
  verifyIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  verifyIconText: { fontSize: 19, fontWeight: '900' },
  verifyCopy: { flex: 1 },
  verifyTitle: { fontSize: 13, fontWeight: '800' },
  verifyDetail: { fontSize: 10, lineHeight: 14, marginTop: 3 },
  verifyArrow: { fontSize: 26, fontWeight: '300' },
});
