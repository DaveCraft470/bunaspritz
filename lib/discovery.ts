import { SpritzEvent } from '@/constants/events';

export type DiscoveryDateFilter = 'all' | 'today' | 'tomorrow' | 'weekend' | 'next7' | 'month';
export type DiscoveryPriceFilter = 'all' | 'free' | 'under50' | '50to100' | 'over100';
export type DiscoverySort = 'relevant' | 'soonest' | 'cheapest' | 'mostExpensive';

export type DiscoveryFilters = {
  genre: string;
  date: DiscoveryDateFilter;
  price: DiscoveryPriceFilter;
  sort: DiscoverySort;
  query: string;
};

export const DEFAULT_DISCOVERY_FILTERS: DiscoveryFilters = {
  genre: 'all',
  date: 'all',
  price: 'all',
  sort: 'relevant',
  query: '',
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(left: Date, right: Date) {
  return startOfDay(left).getTime() === startOfDay(right).getTime();
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('ro-RO');
}

function matchesDate(date: Date, filter: DiscoveryDateFilter, now: Date) {
  const today = startOfDay(now);
  if (filter === 'all') return true;
  if (filter === 'today') return sameDay(date, today);
  if (filter === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return sameDay(date, tomorrow);
  }
  if (filter === 'weekend') return date.getDay() === 0 || date.getDay() === 6;
  if (filter === 'next7') {
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    return date.getTime() >= now.getTime() && date.getTime() <= end.getTime();
  }
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function matchesPrice(price: number | null, filter: DiscoveryPriceFilter) {
  if (filter === 'all') return true;
  if (filter === 'free') return price === null || price === 0;
  if (price === null) return false;
  if (filter === 'under50') return price > 0 && price <= 50;
  if (filter === '50to100') return price > 50 && price <= 100;
  return price > 100;
}

function searchScore(event: SpritzEvent, query: string) {
  const term = normalize(query);
  if (!term) return 0;
  const title = normalize(event.title);
  const genre = normalize(event.genre);
  const detail = normalize(event.detail);
  if (title === term) return 30;
  if (title.includes(term)) return 20;
  if (genre.includes(term)) return 16;
  if (detail.includes(term)) return 12;
  return 0;
}

export function getDiscoveryGenres(events: SpritzEvent[]) {
  return Array.from(new Set(events.map((event) => event.genre.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'ro-RO'),
  );
}

export function getDiscoverableEvents(events: SpritzEvent[], filters: DiscoveryFilters, now = new Date()) {
  const query = normalize(filters.query);
  const eligible = events.filter((event) => {
    if (!event.startsAt || new Date(event.startsAt).getTime() <= now.getTime()) return false;
    const startsAt = new Date(event.startsAt);
    const searchable = normalize(`${event.title} ${event.detail} ${event.genre}`);
    return (
      (!query || searchable.includes(query)) &&
      (filters.genre === 'all' || normalize(event.genre) === normalize(filters.genre)) &&
      matchesDate(startsAt, filters.date, now) &&
      matchesPrice(event.entryFeeRon, filters.price)
    );
  });

  return eligible.sort((left, right) => {
    const leftTime = new Date(left.startsAt!).getTime();
    const rightTime = new Date(right.startsAt!).getTime();
    if (filters.sort === 'soonest') return leftTime - rightTime;
    if (filters.sort === 'cheapest') return (left.entryFeeRon ?? 0) - (right.entryFeeRon ?? 0);
    if (filters.sort === 'mostExpensive') return (right.entryFeeRon ?? 0) - (left.entryFeeRon ?? 0);
    return searchScore(right, filters.query) - searchScore(left, filters.query) || leftTime - rightTime;
  });
}
