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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { colors, spacing } from '@/constants/theme';
import { SpritzEvent } from '@/constants/events';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useEvents } from '@/contexts/EventsContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUser } from '@/contexts/UserContext';
import type { Translations } from '@/lib/i18n/ro';
import {
  DEFAULT_DISCOVERY_FILTERS,
  DiscoveryDateFilter,
  DiscoveryFilters,
  DiscoveryPriceFilter,
  DiscoverySort,
  getDiscoverableEvents,
  getDiscoveryGenres,
} from '@/lib/discovery';

function getDateFilters(t: Translations): Array<{ label: string; value: DiscoveryDateFilter }> {
  return [
    { label: t.discover.allDates, value: 'all' },
    { label: t.discover.today, value: 'today' },
    { label: t.discover.tomorrow, value: 'tomorrow' },
    { label: t.discover.weekend, value: 'weekend' },
    { label: t.discover.next7Days, value: 'next7' },
    { label: t.discover.thisMonth, value: 'month' },
  ];
}

function getPriceFilters(t: Translations): Array<{ label: string; value: DiscoveryPriceFilter }> {
  return [
    { label: t.discover.allPrices, value: 'all' },
    { label: t.discover.free, value: 'free' },
    { label: t.discover.under50, value: 'under50' },
    { label: t.discover.from50to100, value: '50to100' },
    { label: t.discover.over100, value: 'over100' },
  ];
}

function getSortOptions(t: Translations): Array<{ label: string; value: DiscoverySort }> {
  return [
    { label: t.discover.relevant, value: 'relevant' },
    { label: t.discover.soonest, value: 'soonest' },
    { label: t.discover.cheapest, value: 'cheapest' },
    { label: t.discover.mostExpensive, value: 'mostExpensive' },
  ];
}

function formatEventDate(event: SpritzEvent, locale: string) {
  const date = new Date(event.startsAt!);
  return `${date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })} · ${date.toLocaleTimeString(
    locale,
    { hour: '2-digit', minute: '2-digit' },
  )}`;
}

function EventCard({ event }: { event: SpritzEvent }) {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const { t, locale } = useLanguage();
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
          {user?.id === event.hostId && <Text style={styles.ownerBadge}>{t.discover.yourEvent}</Text>}
          {event.source === 'scraper' && <Text style={styles.scrapedBadge}>{t.discover.online}</Text>}
        </View>
        <Text style={[styles.eventMeta, { color: theme.textSecondary }]} numberOfLines={1}>
          {formatEventDate(event, locale)}{event.genre ? ` · ${event.genre}` : ''}
        </Text>
        <Text style={[styles.eventMeta, { color: theme.textSecondary }]} numberOfLines={1}>
          {event.entryFeeRon === null || event.entryFeeRon === 0 ? t.discover.free : `${event.entryFeeRon} RON`}
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
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { events, loading, error, refresh } = useEvents();
  const [filters, setFilters] = useState<DiscoveryFilters>(DEFAULT_DISCOVERY_FILTERS);
  const [refreshing, setRefreshing] = useState(false);
  const genres = useMemo(() => getDiscoveryGenres(events), [events]);
  const genreOptions = useMemo(() => [{ label: t.discover.allGenres, value: 'all' }, ...genres.map((genre) => ({ label: genre, value: genre }))], [genres, t]);
  const dateFilters = useMemo(() => getDateFilters(t), [t]);
  const priceFilters = useMemo(() => getPriceFilters(t), [t]);
  const sortOptions = useMemo(() => getSortOptions(t), [t]);
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
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green500} />}
      >
        <View style={styles.header}>
          <AnimatedPressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
          </AnimatedPressable>
          <Text style={[styles.title, { color: theme.textPrimary }]}>{t.discover.title}</Text>
          <View style={styles.backButton} />
        </View>

        <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={19} color={theme.textSecondary} />
          <TextInput
            value={filters.query}
            onChangeText={(query) => updateFilters({ query })}
            placeholder={t.discover.searchPlaceholder}
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.textPrimary }]}
            returnKeyType="search"
          />
        </View>

        <Text style={[styles.sectionLabel, { color: theme.textPrimary }]}>{t.discover.genre}</Text>
        <ChipRow options={genreOptions} value={filters.genre} onChange={(genre) => updateFilters({ genre })} />
        <Text style={[styles.sectionLabel, { color: theme.textPrimary }]}>{t.discover.date}</Text>
        <ChipRow options={dateFilters} value={filters.date} onChange={(date) => updateFilters({ date })} />
        <Text style={[styles.sectionLabel, { color: theme.textPrimary }]}>{t.discover.price}</Text>
        <ChipRow options={priceFilters} value={filters.price} onChange={(price) => updateFilters({ price })} />
        <View style={styles.sortHeader}>
          <Text style={[styles.sectionLabel, { color: theme.textPrimary }]}>{t.discover.sort}</Text>
          {activeFilterCount > 0 && (
            <AnimatedPressable onPress={() => setFilters({ ...DEFAULT_DISCOVERY_FILTERS, query: filters.query })}>
              <Text style={styles.resetText}>{t.discover.resetFilters(activeFilterCount)}</Text>
            </AnimatedPressable>
          )}
        </View>
        <ChipRow options={sortOptions} value={filters.sort} onChange={(sort) => updateFilters({ sort })} />

        {loading ? (
          <View style={styles.state}>
            <ActivityIndicator color={colors.green500} />
            <Text style={[styles.stateText, { color: theme.textSecondary }]}>{t.discover.loadingEvents}</Text>
          </View>
        ) : error ? (
          <View style={styles.state}>
            <Text style={[styles.stateText, { color: theme.textSecondary }]}>{t.discover.couldNotLoadEvents}</Text>
            <AnimatedPressable onPress={refresh} style={[styles.retryButton, { borderColor: theme.border }]}>
              <Text style={[styles.retryText, { color: theme.textPrimary }]}>{t.discover.retry}</Text>
            </AnimatedPressable>
          </View>
        ) : results.length ? (
          <View style={styles.results}>
            <Text style={[styles.resultsCount, { color: theme.textSecondary }]}>{t.discover.eventsCount(results.length)}</Text>
            {results.map((event) => <EventCard key={event.id} event={event} />)}
          </View>
        ) : (
          <View style={styles.state}>
            <Text style={[styles.stateTitle, { color: theme.textPrimary }]}>{t.discover.noEventsFound}</Text>
            {filters.query && <Text style={[styles.stateText, { color: theme.textSecondary }]}>{t.discover.tryAnotherSearchTerm}</Text>}
            <AnimatedPressable onPress={() => setFilters(DEFAULT_DISCOVERY_FILTERS)} style={[styles.retryButton, { borderColor: theme.border }]}>
              <Text style={[styles.retryText, { color: theme.textPrimary }]}>{t.discover.resetFiltersButton}</Text>
            </AnimatedPressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },
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
  scrapedBadge: { color: '#8B5CF6', fontSize: 10, fontWeight: '800' }, // matches the scraped-event pin color (SCRAPER_COLOR in the edge function)
  state: { alignItems: 'center', paddingVertical: spacing.xxxl },
  stateTitle: { fontSize: 16, fontWeight: '800' },
  stateText: { fontSize: 13, textAlign: 'center', marginTop: spacing.sm },
  retryButton: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 10, marginTop: spacing.md },
  retryText: { fontSize: 13, fontWeight: '700' },
});
