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
import { useLanguage } from '@/contexts/LanguageContext';
import { useUser } from '@/contexts/UserContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Avatar } from '@/components/common/Avatar';
import { GlassSurface } from '@/components/common/GlassSurface';
import { FriendPrefsModal } from '@/components/social/FriendPrefsModal';
import { FriendPrefs, Profile, blockUser, getBlockedProfiles, getFriendPrefs, setFriendPrefs, unblockUser, unfollow } from '@/lib/social';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  getFriends,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  getRequestProfiles,
  removeFriend,
  rejectFriendRequest,
  subscribeToFriendRequests,
  type FriendRequest,
} from '@/lib/friendRequests';
import { useStories } from '@/contexts/StoriesContext';
import { type StoryGroup } from '@/components/stories/StoriesRow';
import { StoryViewer } from '@/components/stories/StoryViewer';
import { FriendsHubTabs } from '@/components/friends/FriendsHubTabs';
import { FriendRow } from '@/components/friends/FriendRow';

export default function Friends() {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const { t } = useLanguage();
  const { user } = useUser();
  const { friendsStories } = useStories();
  const [viewerStories, setViewerStories] = useState<StoryGroup | null>(null);

  const [friends, setFriends] = useState<Profile[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [requestProfiles, setRequestProfiles] = useState<Map<string, Profile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [menuFor, setMenuFor] = useState<Profile | null>(null);
  const [prefs, setPrefs] = useState<FriendPrefs>({ mute_messages: false, mute_activity: false, hide_activity_from: false, blocked: false });
  const [refreshing, setRefreshing] = useState(false);
  const [blocked, setBlocked] = useState<Profile[]>([]);

  function load() {
    if (!user) return;
    setLoading(true);
    setLoadError(false);
    Promise.all([
      getFriends(user.id),
      Promise.resolve(getIncomingFriendRequests(user.id)),
      Promise.resolve(getOutgoingFriendRequests(user.id)),
      getBlockedProfiles(user.id),
    ])
      .then(async ([friendList, incomingList, outgoingList, blockedList]) => {
        setFriends(friendList);
        setIncoming(incomingList);
        setOutgoing(outgoingList);
        setBlocked(blockedList);
        setRequestProfiles(await getRequestProfiles([...incomingList, ...outgoingList]));
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setLoadError(true);
      });
  }

  useEffect(load, [user]);
  useEffect(() => subscribeToFriendRequests(load), [user]);

  async function onRefresh() {
    if (!user) return;
    setRefreshing(true);
    try {
      const [friendList, incomingList, outgoingList, blockedList] = await Promise.all([
        getFriends(user.id),
        Promise.resolve(getIncomingFriendRequests(user.id)),
        Promise.resolve(getOutgoingFriendRequests(user.id)),
        getBlockedProfiles(user.id),
      ]);
      setFriends(friendList);
      setIncoming(incomingList);
      setOutgoing(outgoingList);
      setBlocked(blockedList);
      setRequestProfiles(await getRequestProfiles([...incomingList, ...outgoingList]));
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setRefreshing(false);
    }
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
      showAlert(t.friends.genericErrorTitle, t.friends.errorSavingPref);
    }
  }

  function confirmBlockFriend(friend: Profile) {
    light();
    Alert.alert('Blochezi acest cont?', `${friend.name} nu te va mai putea urmări sau contacta.`, [
      { text: 'Anulează', style: 'cancel' },
      {
        text: 'Blochează',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          const ok = await blockUser(friend.id);
          if (!ok) {
            showAlert('A apărut o eroare', 'Nu am putut bloca acest cont. Încearcă din nou.');
            return;
          }
          // getFriends() also reads the in-memory friend-request store — if
          // an accepted request is left there, the next load() would put
          // this person right back in the friends list even though the DB
          // side (follows/friend_prefs) is already severed.
          removeFriend(user.id, friend.id);
          setFriends((current) => current.filter((f) => f.id !== friend.id));
          setBlocked((current) => [...current, friend]);
          setMenuFor(null);
        },
      },
    ]);
  }

  function confirmUnblock(profile: Profile) {
    light();
    Alert.alert('Deblochezi acest cont?', `${profile.name} va putea din nou să te urmărească.`, [
      { text: 'Anulează', style: 'cancel' },
      {
        text: 'Deblochează',
        onPress: async () => {
          const ok = await unblockUser(profile.id);
          if (!ok) {
            showAlert('A apărut o eroare', 'Nu am putut debloca acest cont. Încearcă din nou.');
            return;
          }
          setBlocked((current) => current.filter((p) => p.id !== profile.id));
        },
      },
    ]);
  }

  function confirmRemoveFriend(friend: Profile) {
    light();
    Alert.alert(t.friends.removeFriendTitle, t.friends.removeFriendMessage(friend.name), [
      { text: t.friends.cancel, style: 'cancel' },
      {
        text: t.friends.remove,
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          const localRemoved = removeFriend(user.id, friend.id);
          const ok = localRemoved || (await unfollow(user.id, friend.id));
          if (!ok) {
            showAlert(t.friends.genericErrorTitle, t.friends.errorRemovingFriend);
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
          accessibilityLabel={t.common.back}
          style={[styles.backButton, shadows.soft, { borderColor: glassButton.border }]}
        >
          <GlassSurface />
          <Ionicons name="chevron-back" size={20} color={glassButton.icon} />
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.textPrimary }]}>{t.friends.title}</Text>
        <View style={styles.backButton} />
      </View>

      <FriendsHubTabs active="friends" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green500} />}
      >
        {loading && (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.green500} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>{t.friends.loadingFriends}</Text>
          </View>
        )}


        {!loading && loadError && (
          <>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {t.friends.couldNotLoadFriends}
            </Text>
            <AnimatedPressable onPress={load} style={[styles.retryButton, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.retryText, { color: theme.textPrimary }]}>{t.friends.retry}</Text>
            </AnimatedPressable>
          </>
        )}

        {!loading && !loadError && (incoming.length > 0 || outgoing.length > 0) && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t.friends.friendRequests}</Text>
            {incoming.length > 0 && <Text style={[styles.subsectionTitle, { color: theme.textSecondary }]}>{t.friends.received}</Text>}
            {incoming.map((request) => {
              const profile = requestProfiles.get(request.senderId);
              if (!profile) return null;
              return (
                <RequestRow
                  key={request.id}
                  profile={profile}
                  theme={theme}
                  primaryLabel={t.friends.accept}
                  secondaryLabel={t.friends.decline}
                  onPrimary={() => acceptFriendRequest(user!.id, request.id)}
                  onSecondary={() => rejectFriendRequest(user!.id, request.id)}
                />
              );
            })}
          </>
        )}

        {!loading && !loadError && outgoing.length > 0 && (
          <>
            <Text style={[styles.subsectionTitle, { color: theme.textSecondary }]}>{t.friends.sent}</Text>
            {outgoing.map((request) => {
              const profile = requestProfiles.get(request.receiverId);
              if (!profile) return null;
              return (
                <RequestRow
                  key={request.id}
                  profile={profile}
                  theme={theme}
                  primaryLabel={t.friends.requestSent}
                  secondaryLabel={t.friends.cancelRequest}
                  primaryDisabled
                  onPrimary={() => {}}
                  onSecondary={() => cancelFriendRequest(user!.id, request.id)}
                />
              );
            })}
          </>
        )}

        {!loading && !loadError && friends.length > 0 && <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t.friends.friendsSectionTitle}</Text>}

        {!loading && !loadError && friends.length === 0 && incoming.length === 0 && outgoing.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>{t.friends.noFriendsYet}</Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t.friends.addPeopleToStart}</Text>
            <AnimatedPressable
              onPress={() => router.push('/search')}
              style={[styles.findFriendsButton, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}
            >
              <Text style={[styles.findFriendsText, { color: theme.accent }]}>{t.friends.findFriends}</Text>
            </AnimatedPressable>
          </View>
        )}

        {friends.map((friend) => {
          const friendStories = friendsStories.filter((story) => story.userId === friend.id);
          const friendStoryGroup = friendStories.length
            ? { userId: friend.id, label: friend.name, stories: friendStories }
            : null;
          return (
          <FriendRow
            key={friend.id}
            friend={friend}
            stories={friendStories}
            onAvatarPress={() => friendStoryGroup && setViewerStories(friendStoryGroup)}
            onProfilePress={() => router.push(`/user/${friend.id}`)}
            onMessagePress={() => router.push({ pathname: '/messages', params: { friendId: friend.id } })}
            onMorePress={() => openMenu(friend)}
          />
          );
        })}

        {!loading && !loadError && blocked.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Conturi blocate</Text>
            {blocked.map((profile) => (
              <View key={profile.id} style={[styles.requestRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Avatar uri={profile.avatar_url} name={profile.name} size={44} fontSize={18} style={styles.avatar} />
                <View style={styles.rowText}>
                  <Text style={[styles.name, { color: theme.textPrimary }]} numberOfLines={1}>{profile.name}</Text>
                  <Text style={[styles.username, { color: theme.textSecondary }]} numberOfLines={1}>@{profile.username}</Text>
                </View>
                <AnimatedPressable
                  onPress={() => confirmUnblock(profile)}
                  style={[styles.requestButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, borderWidth: 1 }]}
                >
                  <Text style={[styles.requestButtonText, { color: theme.textPrimary }]}>Deblochează</Text>
                </AnimatedPressable>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <FriendPrefsModal
        visible={!!menuFor}
        friendName={menuFor?.name ?? ''}
        prefs={prefs}
        onChange={updatePref}
        onRemove={() => menuFor && confirmRemoveFriend(menuFor)}
        onBlock={() => menuFor && confirmBlockFriend(menuFor)}
        onClose={() => setMenuFor(null)}
      />
      <StoryViewer
        visible={!!viewerStories}
        stories={viewerStories?.stories ?? []}
        currentUserId={user?.id}
        onClose={() => setViewerStories(null)}
        onEventPress={(eventId) => {
          setViewerStories(null);
          router.push(`/event/${eventId}`);
        }}
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
  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  findFriendsButton: { minHeight: 42, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' },
  findFriendsText: { fontSize: 12, fontWeight: '800' },
  sectionTitle: { fontSize: 13, fontWeight: '800', marginTop: 8, marginBottom: 10 },
  subsectionTitle: { fontSize: 11, fontWeight: '800', marginTop: 4, marginBottom: 8 },
  retryButton: { alignSelf: 'center', marginTop: 4, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  retryText: { fontSize: 13, fontWeight: '700' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  rowText: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700' },
  username: { fontSize: 11, marginTop: 2 },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: 1, padding: 10, marginBottom: 10 },
  requestButton: { minHeight: 42, paddingHorizontal: 10, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  requestButtonText: { fontSize: 10, fontWeight: '800' },
});

function RequestRow({
  profile,
  theme,
  primaryLabel,
  secondaryLabel,
  primaryDisabled = false,
  onPrimary,
  onSecondary,
}: {
  profile: Profile;
  theme: ReturnType<typeof useAppTheme>['colors'];
  primaryLabel: string;
  secondaryLabel: string;
  primaryDisabled?: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <View style={[styles.requestRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Avatar uri={profile.avatar_url} name={profile.name} size={44} fontSize={18} style={styles.avatar} />
      <View style={styles.rowText}>
        <Text style={[styles.name, { color: theme.textPrimary }]} numberOfLines={1}>{profile.name}</Text>
        <Text style={[styles.username, { color: theme.textSecondary }]} numberOfLines={1}>@{profile.username}</Text>
      </View>
      <AnimatedPressable
        onPress={onPrimary}
        disabled={primaryDisabled}
        style={[styles.requestButton, primaryDisabled && { opacity: 0.7 }, { backgroundColor: primaryDisabled ? theme.surfaceMuted : colors.green500 }]}
      >
        <Text style={[styles.requestButtonText, { color: primaryDisabled ? theme.textSecondary : colors.white }]}>{primaryLabel}</Text>
      </AnimatedPressable>
      <AnimatedPressable
        onPress={onSecondary}
        style={[styles.requestButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, borderWidth: 1 }]}
      >
        <Text style={[styles.requestButtonText, { color: theme.textPrimary }]}>{secondaryLabel}</Text>
      </AnimatedPressable>
    </View>
  );
}
