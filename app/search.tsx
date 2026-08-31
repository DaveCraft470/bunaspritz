import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { follow, getFollowStatus, Profile, searchProfiles } from '@/lib/social';

export default function Search() {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const { user } = useUser();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState<Set<string>>(new Set());

  const trimmedQuery = query.trim();

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

      const statuses = await Promise.all(people.map((p) => getFollowStatus(user.id, p.id)));
      if (cancelled) return;

      setFollowing(new Set(people.filter((_, i) => statuses[i].iFollow).map((p) => p.id)));
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
    await follow(user.id, person.id);
  }

  function renderPerson(person: Profile) {
    const isFollowing = following.has(person.id);
    return (
      <AnimatedPressable
        key={person.id}
        onPress={() => router.push(`/user/${person.id}`)}
        style={[styles.personRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <View style={[styles.avatar, { backgroundColor: theme.surfaceMuted }]}>
          <Text style={[styles.avatarLetter, { color: theme.textPrimary }]}>
            {person.name.trim().charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        <View style={styles.personText}>
          <Text style={[styles.personName, { color: theme.textPrimary }]} numberOfLines={1}>
            {person.name}
          </Text>
          <Text style={[styles.personSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            @{person.username}
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
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Caută un nume sau username ca să găsești oameni pe Spritz.
          </Text>
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
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 18, fontWeight: '800' },
  personText: { flex: 1 },
  personName: { fontSize: 14, fontWeight: '700' },
  personSubtitle: { fontSize: 11, marginTop: 2 },
  addButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  addButtonText: { fontSize: 12, fontWeight: '800' },
});
