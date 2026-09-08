import { useEffect, useMemo, useRef, useState } from 'react';
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
import { EventRow } from '@/components/discover/EventRow';
import { colors, spacing } from '@/constants/theme';
import { SpritzEvent } from '@/constants/events';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useEvents } from '@/contexts/EventsContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUser } from '@/contexts/UserContext';
import type { Translations } from '@/lib/i18n/ro';
import { showAlert } from '@/lib/alert';
import {
  DEFAULT_DISCOVERY_FILTERS,
  DiscoveryDateFilter,
  DiscoveryFilters,
  DiscoveryPriceFilter,
  DiscoverySort,
  getDiscoverableEvents,
  getDiscoveryGenres,
  getLastMinuteEvents,
  getTonightEvents,
  getWeekendEvents,
} from '@/lib/discovery';
import { getTrendingEventIds } from '@/lib/trending';
import { clearRecentSearches, getRecentSearches, getRecentlyViewedEventIds, recordSearch } from '@/lib/recentActivity';
import { dismissEvent, getDismissedEventIds, undoDismissEvent } from '@/lib/eventDismissals';

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

// Last Minute cards' secondary line — "starts in Xh Ym" is more useful there
// than a full date, since by definition these are all starting within hours.
function minutesUntil(startsAt: string | null, t: Translations) {
  if (!startsAt) return null;
  const diffMs = new Date(startsAt).getTime() - Date.now();
  const totalMinutes = Math.max(0, Math.round(diffMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return t.discover.startsInHours(hours, minutes);
  return t.discover.startsInMinutes(minutes);
}

function formatEventDate(event: SpritzEvent, locale: string) {
  const date = new Date(event.startsAt!);
  return `${date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })} · ${date.toLocaleTimeString(
    locale,
    { hour: '2-digit', minute: '2-digit' },
  )}`;
}

function EventCard({ event, onDismiss }: { event: SpritzEvent; onDismiss?: (event: SpritzEvent) => void }) {
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
      {onDismiss && user?.id !== event.hostId && (
        <AnimatedPressable
          onPress={(e) => {
            e?.stopPropagation?.();
            light();
            onDismiss(event);
          }}
          hitSlop={8}
          accessibilityLabel={t.discover.notInterested}
          style={styles.dismissButton}
        >
          <Ionicons name="close-circle-outline" size={19} color={theme.textSecondary} />
        </AnimatedPressable>
      )}
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
  const { user } = useUser();
  const { events, loading, error, refresh } = useEvents();
  const [filters, setFilters] = useState<DiscoveryFilters>(DEFAULT_DISCOVERY_FILTERS);
  const [refreshing, setRefreshing] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [trendingIds, setTrendingIds] = useState<string[]>([]);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [undoEvent, setUndoEvent] = useState<SpritzEvent | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRecordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const genres = useMemo(() => getDiscoveryGenres(events), [events]);
  const genreOptions = useMemo(() => [{ label: t.discover.allGenres, value: 'all' }, ...genres.map((genre) => ({ label: genre, value: genre }))], [genres, t]);
  const dateFilters = useMemo(() => getDateFilters(t), [t]);
  const priceFilters = useMemo(() => getPriceFilters(t), [t]);
  const sortOptions = useMemo(() => getSortOptions(t), [t]);
  const results = useMemo(() => getDiscoverableEvents(events, filters, new Date(), dismissedIds), [events, filters, dismissedIds]);
  const activeFilterCount = Number(filters.genre !== 'all') + Number(filters.date !== 'all') + Number(filters.price !== 'all');

  const lastMinuteEvents = useMemo(() => getLastMinuteEvents(events), [events]);
  const tonightEvents = useMemo(() => getTonightEvents(events), [events]);
  const weekendEvents = useMemo(() => getWeekendEvents(events), [events]);
  const trendingEvents = useMemo(() => {
    const order = new Map(trendingIds.map((id, index) => [id, index]));
    return events.filter((event) => order.has(event.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  }, [events, trendingIds]);
  const recentlyViewedEvents = useMemo(() => {
    const order = new Map(recentlyViewedIds.map((id, index) => [id, index]));
    return events.filter((event) => order.has(event.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  }, [events, recentlyViewedIds]);
  const showBrowseSections = !filters.query && filters.genre === 'all' && filters.date === 'all' && filters.price === 'all';

  useEffect(() => {
    if (!user) return;
    getTrendingEventIds().then(setTrendingIds);
    getRecentlyViewedEventIds(user.id).then(setRecentlyViewedIds);
    getDismissedEventIds(user.id).then((ids) => setDismissedIds(new Set(ids)));
    getRecentSearches(user.id).then(setRecentSearches);
  }, [user]);

  // Debounced, same idiom as app/search.tsx's 300ms people-search debounce —
  // logs a search only once typing settles, not on every keystroke.
  useEffect(() => {
    if (searchRecordTimer.current) clearTimeout(searchRecordTimer.current);
    const trimmed = filters.query.trim();
    if (!user || !trimmed) return;
    searchRecordTimer.current = setTimeout(() => {
      recordSearch(trimmed);
      setRecentSearches((current) => [trimmed, ...current.filter((q) => q.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8));
    }, 800);
    return () => {
      if (searchRecordTimer.current) clearTimeout(searchRecordTimer.current);
    };
  }, [filters.query, user]);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  function updateFilters(patch: Partial<DiscoveryFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  async function handleDismiss(event: SpritzEvent) {
    if (!user) return;
    setDismissedIds((current) => new Set(current).add(event.id));
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoEvent(event);
    undoTimer.current = setTimeout(() => setUndoEvent(null), 4000);
    const ok = await dismissEvent(user.id, event.id);
    if (!ok) {
      setDismissedIds((current) => {
        const next = new Set(current);
        next.delete(event.id);
        return next;
      });
      setUndoEvent((current) => (current?.id === event.id ? null : current));
      showAlert('A apărut o eroare', 'Nu am putut ascunde evenimentul. Încearcă din nou.');
    }
  }

  async function handleUndoDismiss() {
    if (!user || !undoEvent) return;
    const event = undoEvent;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoEvent(null);
    setDismissedIds((current) => {
      const next = new Set(current);
      next.delete(event.id);
      return next;
    });
    const ok = await undoDismissEvent(user.id, event.id);
    if (!ok) {
      setDismissedIds((current) => new Set(current).add(event.id));
      showAlert('A apărut o eroare', 'Nu am putut anula ascunderea. Încearcă din nou.');
    }
  }

  async function handleClearSearches() {
    if (!user) return;
    const previous = recentSearches;
    setRecentSearches([]);
    const ok = await clearRecentSearches(user.id);
    if (!ok) {
      setRecentSearches(previous);
      showAlert('A apărut o eroare', 'Nu am putut șterge căutările recente. Încearcă din nou.');
    }
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
        keyboardShouldPersistTaps="handled"
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
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder={t.discover.searchPlaceholder}
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.textPrimary }]}
            returnKeyType="search"
          />
        </View>

        {searchFocused && !filters.query && recentSearches.length > 0 && (
          <View style={styles.recentSearches}>
            <View style={styles.recentSearchesHeader}>
              <Text style={[styles.sectionLabel, { color: theme.textPrimary, marginTop: 0 }]}>{t.discover.recentSearches}</Text>
              <AnimatedPressable onPress={handleClearSearches}>
                <Text style={styles.resetText}>{t.discover.clearSearches}</Text>
              </AnimatedPressable>
            </View>
            {recentSearches.map((query) => (
              <AnimatedPressable
                key={query}
                onPress={() => updateFilters({ query })}
                style={[styles.recentSearchRow, { borderColor: theme.border }]}
              >
                <Ionicons name="time-outline" size={15} color={theme.textSecondary} />
                <Text style={[styles.recentSearchText, { color: theme.textPrimary }]} numberOfLines={1}>{query}</Text>
              </AnimatedPressable>
            ))}
          </View>
        )}

        {showBrowseSections && (
          <>
            <EventRow title={t.discover.forTonight} events={tonightEvents} />
            <EventRow title={t.discover.forWeekend} events={weekendEvents} />
            <EventRow
              title={t.discover.lastMinute}
              events={lastMinuteEvents}
              getMeta={(event) => minutesUntil(event.startsAt, t)}
            />
            <EventRow title={t.discover.trending} events={trendingEvents} getMeta={() => '🔥'} />
            <EventRow title={t.discover.recentlyViewed} events={recentlyViewedEvents} />
          </>
        )}

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
            {results.map((event) => <EventCard key={event.id} event={event} onDismiss={handleDismiss} />)}
          </View>
        ) : (
          <View style={styles.state}>
            <Text style={[styles.stateTitle, { color: theme.textPrimary }]}>{t.discover.noEventsFound}</Text>
            {Boolean(filters.query) && <Text style={[styles.stateText, { color: theme.textSecondary }]}>{t.discover.tryAnotherSearchTerm}</Text>}
            <AnimatedPressable onPress={() => setFilters(DEFAULT_DISCOVERY_FILTERS)} style={[styles.retryButton, { borderColor: theme.border }]}>
              <Text style={[styles.retryText, { color: theme.textPrimary }]}>{t.discover.resetFiltersButton}</Text>
            </AnimatedPressable>
          </View>
        )}
      </ScrollView>
      {undoEvent && (
        <View style={[styles.undoBanner, { bottom: insets.bottom + 90 }]}>
          <View style={[styles.undoBannerInner, { backgroundColor: theme.textPrimary }]}>
            <Text style={[styles.undoBannerText, { color: theme.page }]} numberOfLines={1}>
              {t.discover.eventHiddenUndo}
            </Text>
            <AnimatedPressable onPress={handleUndoDismiss}>
              <Text style={[styles.undoBannerAction, { color: colors.green400 }]}>{t.discover.undo}</Text>
            </AnimatedPressable>
          </View>
        </View>
      )}
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
  dismissButton: { padding: 2 },
  recentSearches: { marginTop: spacing.sm },
  recentSearchesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recentSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  recentSearchText: { flex: 1, fontSize: 13, fontWeight: '600' },
  undoBanner: { position: 'absolute', left: spacing.lg, right: spacing.lg },
  undoBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  undoBannerText: { flex: 1, fontSize: 13, fontWeight: '700' },
  undoBannerAction: { fontSize: 13, fontWeight: '900' },
});
