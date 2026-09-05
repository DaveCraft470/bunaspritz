import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useEvents } from '@/contexts/EventsContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { isAdminAccessEnabled } from '@/lib/admin';
import { useUser } from '@/contexts/UserContext';
import { getProfiles } from '@/lib/social';

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' }) : 'Data nestabilită';
}

export default function AdminEvents() {
  const { colors: theme } = useAppTheme();
  const { events, loading, error, refresh } = useEvents();
  const { user } = useUser();
  const [query, setQuery] = useState('');
  const [localModeration, setLocalModeration] = useState<Record<string, 'hidden' | 'review'>>({});
  const [hostNames, setHostNames] = useState<Record<string, string>>({});
  useEffect(() => {
    const hostIds = [...new Set(events.map((event) => event.hostId))];
    getProfiles(hostIds).then((profiles) => {
      setHostNames(Object.fromEntries(profiles.map((profile) => [profile.id, `@${profile.username}`])));
    });
  }, [events]);
  const visibleEvents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return events.filter((event) => !normalized || event.title.toLowerCase().includes(normalized) || event.hostId.toLowerCase().includes(normalized));
  }, [events, query]);

  if (!isAdminAccessEnabled(user)) return <AccessDenied />;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />
      <View style={styles.topBar}>
        <AnimatedPressable onPress={() => router.back()} hitSlop={10} style={[styles.backButton, shadows.soft, { borderColor: glassButton.border }]}>
          <Ionicons name="chevron-back" size={20} color={glassButton.icon} />
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Admin Events</Text>
        <View style={styles.backButton} />
      </View>
      <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Caută titlu sau host ID" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.textPrimary }]} />
      </View>
      <FlatList
        data={visibleEvents}
        keyExtractor={(event) => event.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.green500} />}
        ListEmptyComponent={
          loading ? <ActivityIndicator color={colors.green500} style={styles.center} /> :
          error ? (
            <View style={styles.emptyState}>
              <Text style={[styles.empty, { color: theme.textSecondary }]}>Nu am putut încărca evenimentele.</Text>
              <AnimatedPressable onPress={refresh} style={[styles.retryButton, { borderColor: theme.border }]}>
                <Text style={[styles.buttonText, { color: theme.textPrimary }]}>Reîncearcă</Text>
              </AnimatedPressable>
            </View>
          ) : <Text style={[styles.empty, { color: theme.textSecondary }]}>Nu există evenimente.</Text>
        }
        renderItem={({ item }) => {
          const moderation = localModeration[item.id];
          return (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, opacity: moderation === 'hidden' ? 0.55 : 1 }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.icon, { backgroundColor: item.color }]}><Text style={styles.emoji}>{item.emoji}</Text></View>
                <View style={styles.cardText}>
                  <Text style={[styles.eventTitle, { color: theme.textPrimary }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.detail, { color: theme.textSecondary }]}>{formatDate(item.startsAt)}</Text>
                  <Text style={[styles.detail, { color: theme.textSecondary }]}>Organizator: {hostNames[item.hostId] ?? item.hostId}</Text>
                </View>
                {moderation && <Text style={[styles.badge, { color: theme.accent }]}>{moderation === 'hidden' ? 'Ascuns' : 'Review'}</Text>}
              </View>
              <Text style={[styles.detail, { color: theme.textSecondary }]}>Locație disponibilă în model · participanții sunt numărați prin RPC.</Text>
              <View style={styles.actions}>
                <AnimatedPressable onPress={() => router.push(`/event/${item.id}`)} style={[styles.button, { borderColor: theme.border }]}>
                  <Text style={[styles.buttonText, { color: theme.textPrimary }]}>Deschide</Text>
                </AnimatedPressable>
                <AnimatedPressable onPress={() => setLocalModeration((current) => ({ ...current, [item.id]: 'hidden' }))} style={[styles.button, { borderColor: theme.border }]}>
                  <Text style={[styles.buttonText, { color: theme.textPrimary }]}>Ascunde</Text>
                </AnimatedPressable>
                <AnimatedPressable onPress={() => setLocalModeration((current) => ({ ...current, [item.id]: 'review' }))} style={[styles.button, { backgroundColor: colors.green500 }]}>
                  <Text style={[styles.buttonText, { color: colors.white }]}>Review</Text>
                </AnimatedPressable>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

function AccessDenied() {
  const { colors: theme } = useAppTheme();
  return <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}><Text style={[styles.empty, { color: theme.textPrimary }]}>Nu ai acces la Admin Events.</Text><AnimatedPressable onPress={() => router.back()} style={styles.deniedBack}><Text style={[styles.buttonText, { color: theme.accent }]}>Înapoi</Text></AnimatedPressable></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.lg, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12 },
  input: { flex: 1, height: 44, fontSize: 13 },
  content: { padding: spacing.lg, paddingBottom: 50 },
  card: { borderWidth: 1, borderRadius: 17, padding: spacing.md, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22 },
  cardText: { flex: 1 },
  eventTitle: { fontSize: 15, fontWeight: '800' },
  detail: { fontSize: 11, marginTop: 4 },
  badge: { fontSize: 10, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 7, marginTop: spacing.md },
  button: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingVertical: 9 },
  buttonText: { fontSize: 10, fontWeight: '800' },
  empty: { textAlign: 'center', padding: spacing.xl, fontSize: 14 },
  center: { marginTop: spacing.xl },
  emptyState: { alignItems: 'center' },
  retryButton: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginTop: 4 },
  deniedBack: { alignSelf: 'center', padding: spacing.md },
});
