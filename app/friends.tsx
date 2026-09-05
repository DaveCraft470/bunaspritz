import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Alert } from 'react-native';

import { showAlert } from '@/lib/alert';
import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Avatar } from '@/components/common/Avatar';
import { GlassSurface } from '@/components/common/GlassSurface';
import { FriendPrefsModal } from '@/components/social/FriendPrefsModal';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  FriendPrefs,
  FriendRequest,
  getFriendPrefs,
  getFriends,
  getIncomingRequests,
  getOutgoingRequests,
  Profile,
  rejectFriendRequest,
  setFriendPrefs,
  unfriend,
} from '@/lib/social';

export default function Friends() {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const { user } = useUser();

  const [friends, setFriends] = useState<Profile[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [menuFor, setMenuFor] = useState<Profile | null>(null);
  const [prefs, setPrefs] = useState<FriendPrefs>({ mute_messages: false, mute_activity: false, hide_activity_from: false });
  const [refreshing, setRefreshing] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  async function loadAll() {
    if (!user) return [null, null, null] as const;
    return Promise.all([getFriends(user.id), getIncomingRequests(user.id), getOutgoingRequests(user.id)]);
  }

  function load() {
    if (!user) return;
    setLoading(true);
    setLoadError(false);
    loadAll()
      .then(([friendList, incomingList, outgoingList]) => {
        setFriends(friendList ?? []);
        setIncoming(incomingList ?? []);
        setOutgoing(outgoingList ?? []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setLoadError(true);
      });
  }

  useEffect(load, [user]);

  async function onRefresh() {
    if (!user) return;
    setRefreshing(true);
    try {
      const [friendList, incomingList, outgoingList] = await loadAll();
      setFriends(friendList ?? []);
      setIncoming(incomingList ?? []);
      setOutgoing(outgoingList ?? []);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setRefreshing(false);
    }
  }

  async function respondToRequest(request: FriendRequest, accept: boolean) {
    if (respondingId) return;
    light();
    setRespondingId(request.id);
    const ok = accept ? await acceptFriendRequest(request.id) : await rejectFriendRequest(request.id);
    if (!ok) {
      showAlert('A apărut o eroare', 'Nu am putut actualiza cererea. Încearcă din nou.');
    } else {
      setIncoming((current) => current.filter((r) => r.id !== request.id));
      if (accept) setFriends((current) => [request.profile, ...current]);
    }
    setRespondingId(null);
  }

  async function cancelOutgoing(request: FriendRequest) {
    if (respondingId) return;
    light();
    setRespondingId(request.id);
    const ok = await cancelFriendRequest(request.id);
    if (!ok) {
      showAlert('A apărut o eroare', 'Nu am putut anula cererea. Încearcă din nou.');
    } else {
      setOutgoing((current) => current.filter((r) => r.id !== request.id));
    }
    setRespondingId(null);
  }

  async function openMenu(friend: Profile) {
    if (!user) return;
    light();
    setMenuFor(friend);
    setPrefs(await getFriendPrefs(user.id, friend.id));
  }

  async function updatePref(patch: Partial<FriendPrefs>) {
    if (!user || !menuFor) return;
    light();
    const previous = prefs;
    setPrefs((current) => ({ ...current, ...patch }));
    const ok = await setFriendPrefs(user.id, menuFor.id, patch);
    if (!ok) {
      setPrefs(previous);
      showAlert('A apărut o eroare', 'Nu am putut salva preferința. Încearcă din nou.');
    }
  }

  function confirmRemoveFriend(friend: Profile) {
    light();
    Alert.alert('Elimini prietenul?', `Nu vei mai fi conectat cu ${friend.name}.`, [
      { text: 'Anulează', style: 'cancel' },
      {
        text: 'Elimină',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          const ok = await unfriend(friend.id);
          if (!ok) {
            showAlert('A apărut o eroare', 'Nu am putut elimina prietenul. Încearcă din nou.');
            return;
          }
          setFriends((current) => current.filter((f) => f.id !== friend.id));
          setMenuFor(null);
        },
      },
    ]);
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

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green500} />}
      >
        {loading && (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.green500} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Se încarcă prietenii...</Text>
          </View>
        )}

        {!loading && loadError && (
          <>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Nu am putut încărca prietenii. Verifică conexiunea și încearcă din nou.
            </Text>
            <AnimatedPressable onPress={load} style={[styles.retryButton, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.retryText, { color: theme.textPrimary }]}>Reîncearcă</Text>
            </AnimatedPressable>
          </>
        )}

        {!loading && !loadError && incoming.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Cereri primite</Text>
            {incoming.map((request) => (
              <View key={request.id} style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Avatar uri={request.profile.avatar_url} name={request.profile.name} size={44} fontSize={18} style={styles.avatar} />
                <View style={styles.rowText}>
                  <Text style={[styles.name, { color: theme.textPrimary }]} numberOfLines={1}>
                    {request.profile.name}
                  </Text>
                  <Text style={[styles.username, { color: theme.textSecondary }]} numberOfLines={1}>
                    @{request.profile.username}
                  </Text>
                </View>
                <AnimatedPressable
                  onPress={() => respondToRequest(request, true)}
                  disabled={respondingId === request.id}
                  style={[styles.pillButton, { backgroundColor: colors.green500 }]}
                >
                  <Text style={[styles.pillButtonText, { color: colors.white }]}>Acceptă</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  onPress={() => respondToRequest(request, false)}
                  disabled={respondingId === request.id}
                  style={[styles.pillButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, borderWidth: 1 }]}
                >
                  <Text style={[styles.pillButtonText, { color: theme.textPrimary }]}>Refuză</Text>
                </AnimatedPressable>
              </View>
            ))}
          </>
        )}

        {!loading && !loadError && outgoing.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Cereri trimise</Text>
            {outgoing.map((request) => (
              <View key={request.id} style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Avatar uri={request.profile.avatar_url} name={request.profile.name} size={44} fontSize={18} style={styles.avatar} />
                <View style={styles.rowText}>
                  <Text style={[styles.name, { color: theme.textPrimary }]} numberOfLines={1}>
                    {request.profile.name}
                  </Text>
                  <Text style={[styles.username, { color: theme.textSecondary }]} numberOfLines={1}>
                    @{request.profile.username}
                  </Text>
                </View>
                <AnimatedPressable
                  onPress={() => cancelOutgoing(request)}
                  disabled={respondingId === request.id}
                  style={[styles.pillButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, borderWidth: 1 }]}
                >
                  <Text style={[styles.pillButtonText, { color: theme.textPrimary }]}>Anulează</Text>
                </AnimatedPressable>
              </View>
            ))}
          </>
        )}

        {!loading && !loadError && (incoming.length > 0 || outgoing.length > 0) && friends.length > 0 && (
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Prieteni</Text>
        )}

        {!loading && !loadError && friends.length === 0 && incoming.length === 0 && outgoing.length === 0 && (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Încă nu ai prieteni — caută oameni și trimite-le o cerere de prietenie.
          </Text>
        )}

        {friends.map((friend) => (
          <AnimatedPressable
            key={friend.id}
            onPress={() => router.push(`/user/${friend.id}`)}
            style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Avatar uri={friend.avatar_url} name={friend.name} size={44} fontSize={18} style={styles.avatar} />
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
        onRemove={() => menuFor && confirmRemoveFriend(menuFor)}
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
  loadingState: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  loadingText: { fontSize: 13 },
  emptyText: { fontSize: 13, fontStyle: 'italic', paddingVertical: 20, textAlign: 'center' },
  retryButton: { alignSelf: 'center', marginTop: 4, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  retryText: { fontSize: 13, fontWeight: '700' },
  sectionLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  rowText: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700' },
  username: { fontSize: 11, marginTop: 2 },
  menuButton: { padding: 6 },
  pillButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginLeft: 6 },
  pillButtonText: { fontSize: 12, fontWeight: '800' },
});
