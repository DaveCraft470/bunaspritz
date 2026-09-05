import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { colors, spacing } from '@/constants/theme';
import { SpritzEvent } from '@/constants/events';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useEvents } from '@/contexts/EventsContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import {
  DEFAULT_DISCOVERY_FILTERS,
  DiscoveryDateFilter,
  DiscoveryFilters,
  DiscoveryPriceFilter,
  DiscoverySort,
  getDiscoverableEvents,
  getDiscoveryGenres,
} from '@/lib/discovery';

const DATE_FILTERS: Array<{ label: string; value: DiscoveryDateFilter }> = [
  { label: 'Toate datele', value: 'all' },
  { label: 'Azi', value: 'today' },
  { label: 'Mâine', value: 'tomorrow' },
  { label: 'Weekend', value: 'weekend' },
  { label: '7 zile', value: 'next7' },
  { label: 'Luna aceasta', value: 'month' },
];

const PRICE_FILTERS: Array<{ label: string; value: DiscoveryPriceFilter }> = [
  { label: 'Toate prețurile', value: 'all' },
  { label: 'Gratuit', value: 'free' },
  { label: '0–50 lei', value: 'under50' },
  { label: '50–100 lei', value: '50to100' },
  { label: '100+ lei', value: 'over100' },
];

const SORT_OPTIONS: Array<{ label: string; value: DiscoverySort }> = [
  { label: 'Relevante', value: 'relevant' },
  { label: 'Cele mai apropiate ca dată', value: 'soonest' },
  { label: 'Cele mai ieftine', value: 'cheapest' },
  { label: 'Cele mai scumpe', value: 'mostExpensive' },
];

function formatEventDate(event: SpritzEvent) {
  const date = new Date(event.startsAt!);
  return `${date.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' })} · ${date.toLocaleTimeString(
    'ro-RO',
    { hour: '2-digit', minute: '2-digit' },
  )}`;
}

function EventCard({ event }: { event: SpritzEvent }) {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const { user } = useUser();

  return (
    <AnimatedPressable
      onPress={() => {
        light();
        router.push(`/event/${event.id}`);
      }}
      style={[styles.eventCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={[styles.eventIcon, { backgroundColor: event.color }]}>
        <Text style={styles.eventEmoji}>{event.emoji}</Text>
      </View>
      <View style={styles.eventCopy}>
        <View style={styles.titleRow}>
          <Text style={[styles.eventTitle, { color: theme.textPrimary }]} numberOfLines={1}>
            {event.title}
          </Text>
          {user?.id === event.hostId && <Text style={styles.ownerBadge}>Evenimentul tău</Text>}
        </View>
        <Text style={[styles.eventMeta, { color: theme.textSecondary }]} numberOfLines={1}>
          {formatEventDate(event)}{event.genre ? ` · ${event.genre}` : ''}
        </Text>
        <Text style={[styles.eventMeta, { color: theme.textSecondary }]} numberOfLines={1}>
          {event.entryFeeRon === null || event.entryFeeRon === 0 ? 'Gratuit' : `${event.entryFeeRon} RON`}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </AnimatedPressable>
  );
}

function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {options.map((option) => (
        <AnimatedPressable
          key={option.value}
          onPress={() => {
            light();
            onChange(option.value);
          }}
          style={[styles.chip, { backgroundColor: value === option.value ? colors.green500 : theme.surface, borderColor: theme.border }]}
        >
          <Text style={[styles.chipText, { color: value === option.value ? colors.white : theme.textSecondary }]}>
            {option.label}
          </Text>
        </AnimatedPressable>
      ))}
    </ScrollView>
  );
}

export default function Discover() {
  const { colors: theme } = useAppTheme();
  const { events, loading, error, refresh } = useEvents();
  const [filters, setFilters] = useState<DiscoveryFilters>(DEFAULT_DISCOVERY_FILTERS);
  const [refreshing, setRefreshing] = useState(false);
  const genres = useMemo(() => getDiscoveryGenres(events), [events]);
  const genreOptions = useMemo(() => [{ label: 'Toate genurile', value: 'all' }, ...genres.map((genre) => ({ label: genre, value: genre }))], [genres]);
  const results = useMemo(() => getDiscoverableEvents(events, filters), [events, filters]);
  const activeFilterCount = Number(filters.genre !== 'all') + Number(filters.date !== 'all') + Number(filters.price !== 'all');

  function updateFilters(patch: Partial<DiscoveryFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green500} />}
      >
        <View style={styles.header}>
          <AnimatedPressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
          </AnimatedPressable>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Explorează</Text>
          <View style={styles.backButton} />
        </View>

        <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={19} color={theme.textSecondary} />
          <TextInput
            value={filters.query}
            onChangeText={(query) => updateFilters({ query })}
            placeholder="Caută evenimente..."
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.textPrimary }]}
            returnKeyType="search"
          />
        </View>

        <Text style={[styles.sectionLabel, { color: theme.textPrimary }]}>Gen</Text>
        <ChipRow options={genreOptions} value={filters.genre} onChange={(genre) => updateFilters({ genre })} />
        <Text style={[styles.sectionLabel, { color: theme.textPrimary }]}>Data</Text>
        <ChipRow options={DATE_FILTERS} value={filters.date} onChange={(date) => updateFilters({ date })} />
        <Text style={[styles.sectionLabel, { color: theme.textPrimary }]}>Preț</Text>
        <ChipRow options={PRICE_FILTERS} value={filters.price} onChange={(price) => updateFilters({ price })} />
        <View style={styles.sortHeader}>
          <Text style={[styles.sectionLabel, { color: theme.textPrimary }]}>Sortează</Text>
          {activeFilterCount > 0 && (
            <AnimatedPressable onPress={() => setFilters({ ...DEFAULT_DISCOVERY_FILTERS, query: filters.query })}>
              <Text style={styles.resetText}>Resetare filtre ({activeFilterCount})</Text>
            </AnimatedPressable>
          )}
        </View>
        <ChipRow options={SORT_OPTIONS} value={filters.sort} onChange={(sort) => updateFilters({ sort })} />

        {loading ? (
          <View style={styles.state}>
            <ActivityIndicator color={colors.green500} />
            <Text style={[styles.stateText, { color: theme.textSecondary }]}>Se încarcă evenimentele...</Text>
          </View>
        ) : error ? (
          <View style={styles.state}>
            <Text style={[styles.stateText, { color: theme.textSecondary }]}>Nu am putut încărca evenimentele.</Text>
            <AnimatedPressable onPress={refresh} style={[styles.retryButton, { borderColor: theme.border }]}>
              <Text style={[styles.retryText, { color: theme.textPrimary }]}>Reîncearcă</Text>
            </AnimatedPressable>
          </View>
        ) : results.length ? (
          <View style={styles.results}>
            <Text style={[styles.resultsCount, { color: theme.textSecondary }]}>{results.length} evenimente</Text>
            {results.map((event) => <EventCard key={event.id} event={event} />)}
          </View>
        ) : (
          <View style={styles.state}>
            <Text style={[styles.stateTitle, { color: theme.textPrimary }]}>Nu am găsit evenimente.</Text>
            {filters.query && <Text style={[styles.stateText, { color: theme.textSecondary }]}>Încearcă un alt termen de căutare.</Text>}
            <AnimatedPressable onPress={() => setFilters(DEFAULT_DISCOVERY_FILTERS)} style={[styles.retryButton, { borderColor: theme.border }]}>
              <Text style={[styles.retryText, { color: theme.textPrimary }]}>Resetează filtrele</Text>
            </AnimatedPressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, minHeight: 48 },
  searchInput: { flex: 1, fontSize: 15 },
  sectionLabel: { fontSize: 14, fontWeight: '800', marginTop: spacing.lg, marginBottom: spacing.sm },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  chipText: { fontSize: 12, fontWeight: '700' },
  sortHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resetText: { color: colors.green700, fontSize: 12, fontWeight: '700' },
  results: { marginTop: spacing.lg },
  resultsCount: { fontSize: 12, marginBottom: spacing.sm },
  eventCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: 16, borderWidth: 1, padding: 13, marginBottom: spacing.sm },
  eventIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  eventEmoji: { fontSize: 23 },
  eventCopy: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eventTitle: { flex: 1, fontSize: 15, fontWeight: '800' },
  eventMeta: { fontSize: 11, marginTop: 4 },
  ownerBadge: { color: colors.green700, fontSize: 10, fontWeight: '800' },
  state: { alignItems: 'center', paddingVertical: spacing.xxxl },
  stateTitle: { fontSize: 16, fontWeight: '800' },
  stateText: { fontSize: 13, textAlign: 'center', marginTop: spacing.sm },
  retryButton: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 10, marginTop: spacing.md },
  retryText: { fontSize: 13, fontWeight: '700' },
});
