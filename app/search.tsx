import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { showAlert } from '@/lib/alert';
import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Avatar } from '@/components/common/Avatar';
import { GlassSurface } from '@/components/common/GlassSurface';
import {
  follow,
  getBlockedIds,
  getFollowStatuses,
  getFollowingIds,
  getRandomProfiles,
  getSuggestedFriends,
  Profile,
  searchProfiles,
  SuggestedProfile,
} from '@/lib/social';
import { getOutgoingFriendRequests } from '@/lib/friendRequests';

const REASON_LABEL: Record<SuggestedProfile['reason'], string> = {
  mutual: 'Prieteni în comun',
  event: 'A fost la același Spritz',
};

export default function Search() {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const { user } = useUser();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState<Set<string>>(new Set());

  const [suggestions, setSuggestions] = useState<(Profile & { reason?: SuggestedProfile['reason'] })[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      setSuggestionsLoading(true);
      // Pending outgoing requests only live in the in-memory store in
      // lib/friendRequests.ts (not the DB), so the RPC can't filter them —
      // do it client-side instead.
      const alreadyRequested = new Set(getOutgoingFriendRequests(user.id).map((request) => request.receiverId));

      const graphSuggestions = (await getSuggestedFriends(10)).filter((person) => !alreadyRequested.has(person.id));
      if (cancelled) return;

      if (graphSuggestions.length > 0) {
        setSuggestions(graphSuggestions);
        setSuggestionsLoading(false);
        return;
      }

      // No friends-of-friends or shared-event overlap yet — fall back to a
      // shuffled page of other people with an account. blockedIds only
      // covers people *I* blocked (friend_prefs RLS hides the reverse), so
      // someone who blocked me could still show up here; adding them just
      // fails with the generic error alert, which is an acceptable edge case.
      const [followingIds, blockedIds] = await Promise.all([getFollowingIds(user.id), getBlockedIds(user.id)]);
      if (cancelled) return;
      const excludeIds = [...followingIds, ...blockedIds, ...alreadyRequested];
      const random = await getRandomProfiles(user.id, excludeIds, 10);
      if (cancelled) return;
      setSuggestions(random);
      setSuggestionsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !trimmedQuery) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      const people = await searchProfiles(trimmedQuery, user.id);
      if (cancelled) return;

      const statuses = await getFollowStatuses(user.id, people.map((p) => p.id));
      if (cancelled) return;

      setFollowing(new Set(people.filter((p) => statuses[p.id]?.iFollow).map((p) => p.id)));
      setResults(people);
      setLoading(false);
    }, 300); // debounce

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedQuery, user]);

  async function handleAdd(person: Profile) {
    if (!user) return;
    light();
    setFollowing((current) => new Set(current).add(person.id));
    const ok = await follow(user.id, person.id);
    if (!ok) {
      // Revert the optimistic mark — this used to show "Adăugat ✓" even
      // when the insert failed, since follow() swallowed its own error.
      setFollowing((current) => {
        const next = new Set(current);
        next.delete(person.id);
        return next;
      });
      showAlert('A apărut o eroare', 'Nu am putut urmări acest cont. Încearcă din nou.');
    }
  }

  function renderPerson(person: Profile & { reason?: SuggestedProfile['reason'] }) {
    const isFollowing = following.has(person.id);
    return (
      <AnimatedPressable
        key={person.id}
        onPress={() => router.push(`/user/${person.id}`)}
        style={[styles.personRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <Avatar uri={person.avatar_url} name={person.name} size={44} fontSize={18} style={styles.avatar} />
        <View style={styles.personText}>
          <Text style={[styles.personName, { color: theme.textPrimary }]} numberOfLines={1}>
            {person.name}
          </Text>
          <Text style={[styles.personSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {person.reason ? REASON_LABEL[person.reason] : `@${person.username}`}
          </Text>
        </View>
        <AnimatedPressable
          onPress={() => handleAdd(person)}
          disabled={isFollowing}
          style={[
            styles.addButton,
            isFollowing
              ? { backgroundColor: theme.surfaceMuted, borderColor: theme.border, borderWidth: 1 }
              : { backgroundColor: colors.green500 },
          ]}
        >
          <Text style={[styles.addButtonText, { color: isFollowing ? theme.textSecondary : colors.white }]}>
            {isFollowing ? 'Adăugat ✓' : 'Adaugă'}
          </Text>
        </AnimatedPressable>
      </AnimatedPressable>
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
        <Text style={[styles.title, { color: theme.textPrimary }]}>Caută prieteni</Text>
        <View style={styles.backButton} />
      </View>

      <AnimatedPressable
        onPress={() => {
          light();
          router.push('/friends');
        }}
        style={[styles.manageButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <Ionicons name="people" size={16} color={colors.green500} />
        <Text style={[styles.manageButtonText, { color: theme.textPrimary }]}>Prietenii mei — gestionează</Text>
        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
      </AnimatedPressable>

      <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Caută după nume sau username..."
          placeholderTextColor={theme.textSecondary}
          style={[styles.searchInput, { color: theme.textPrimary }]}
          autoCapitalize="none"
        />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!trimmedQuery ? (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Sugestii pentru tine</Text>
            {suggestionsLoading ? (
              <ActivityIndicator color={colors.green500} style={styles.loading} />
            ) : suggestions.length ? (
              suggestions.map(renderPerson)
            ) : (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Nu avem încă sugestii pentru tine.
              </Text>
            )}
          </>
        ) : loading ? (
          <ActivityIndicator color={colors.green500} style={styles.loading} />
        ) : results.length ? (
          results.map(renderPerson)
        ) : (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Nimeni pe numele ăsta — încearcă altă căutare.
          </Text>
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
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  manageButtonText: { flex: 1, fontSize: 13, fontWeight: '700' },
  sectionTitle: { fontSize: 13, fontWeight: '800', marginBottom: 10 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 2 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  loading: { marginTop: 30 },
  emptyText: { fontSize: 13, fontStyle: 'italic', paddingVertical: 12 },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  personText: { flex: 1 },
  personName: { fontSize: 14, fontWeight: '700' },
  personSubtitle: { fontSize: 11, marginTop: 2 },
  addButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  addButtonText: { fontSize: 12, fontWeight: '800' },
});
