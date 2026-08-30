import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PEOPLE_POOL, type SuggestedPerson } from '@/constants/people';
import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { GlassSurface } from '@/components/common/GlassSurface';

export default function Search() {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const [query, setQuery] = useState('');
  const [added, setAdded] = useState<Set<string>>(new Set());

  const trimmedQuery = query.trim().toLowerCase();
  const suggested = useMemo(() => PEOPLE_POOL.filter((p) => p.pastEventTitle), []);
  const friendsOfFriends = useMemo(() => PEOPLE_POOL.filter((p) => p.viaFriend), []);
  const results = useMemo(
    () => (trimmedQuery ? PEOPLE_POOL.filter((p) => p.name.toLowerCase().includes(trimmedQuery)) : []),
    [trimmedQuery]
  );

  function toggleAdded(id: string) {
    light();
    setAdded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderPerson(person: SuggestedPerson, subtitle: string | null) {
    const isAdded = added.has(person.id);
    return (
      <View key={person.id} style={[styles.personRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[styles.avatar, { backgroundColor: theme.surfaceMuted }]}>
          <Text style={styles.avatarEmoji}>{person.emoji}</Text>
        </View>
        <View style={styles.personText}>
          <Text style={[styles.personName, { color: theme.textPrimary }]} numberOfLines={1}>
            {person.name}
          </Text>
          {subtitle ? (
            <Text style={[styles.personSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <AnimatedPressable
          onPress={() => toggleAdded(person.id)}
          style={[
            styles.addButton,
            isAdded
              ? { backgroundColor: theme.surfaceMuted, borderColor: theme.border, borderWidth: 1 }
              : { backgroundColor: colors.green500 },
          ]}
        >
          <Text style={[styles.addButtonText, { color: isAdded ? theme.textSecondary : colors.white }]}>
            {isAdded ? 'Adăugat ✓' : 'Adaugă'}
          </Text>
        </AnimatedPressable>
      </View>
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
          placeholder="Caută după nume..."
          placeholderTextColor={theme.textSecondary}
          style={[styles.searchInput, { color: theme.textPrimary }]}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {trimmedQuery ? (
          <>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>REZULTATE</Text>
            {results.length ? (
              results.map((p) => renderPerson(p, null))
            ) : (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Nimeni pe numele ăsta — încearcă altă căutare.
              </Text>
            )}
          </>
        ) : (
          <>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>SUGESTII</Text>
            {suggested.map((p) => renderPerson(p, `Ai mai fost la Spritz cu el/ea la „${p.pastEventTitle}"`))}

            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced, { color: theme.textSecondary }]}>
              PRIETENII PRIETENILOR
            </Text>
            {friendsOfFriends.map((p) => renderPerson(p, `Prieten cu ${p.viaFriend}`))}
          </>
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
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 8 },
  sectionLabelSpaced: { marginTop: 20 },
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
  avatarEmoji: { fontSize: 20 },
  personText: { flex: 1 },
  personName: { fontSize: 14, fontWeight: '700' },
  personSubtitle: { fontSize: 11, marginTop: 2 },
  addButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  addButtonText: { fontSize: 12, fontWeight: '800' },
});
