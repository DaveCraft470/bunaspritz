import { SpritzEvent } from '@/constants/events';

export const RECOMMENDATION_WEIGHTS = {
  genreMatch: 40,
  distance: 30,
  behavior: 20,
  timing: 15,
  popularity: 10,
} as const;

export type RecommendationContext = {
  joinedEventIds?: ReadonlySet<string>;
  preferredGenres?: ReadonlySet<string>;
  location?: { lat: number; lng: number };
  attendeeCounts?: ReadonlyMap<string, number>;
};

export type RecommendedEvent = {
  event: SpritzEvent;
  score: number;
  reason: 'Potrivit pentru tine' | 'Aproape de tine' | 'Începe curând' | 'Popular';
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('ro-RO');
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const earthRadiusKm = 6371;
  const latDelta = ((b.lat - a.lat) * Math.PI) / 180;
  const lngDelta = ((b.lng - a.lng) * Math.PI) / 180;
  const latA = (a.lat * Math.PI) / 180;
  const latB = (b.lat * Math.PI) / 180;
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(latA) * Math.cos(latB) * Math.sin(lngDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function timingScore(startsAt: string) {
  const hoursUntilStart = (new Date(startsAt).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntilStart <= 0) return 0;
  return Math.max(0, RECOMMENDATION_WEIGHTS.timing * (1 - Math.min(hoursUntilStart, 24 * 14) / (24 * 14)));
}

function diversify(items: RecommendedEvent[], limit: number) {
  const selected: RecommendedEvent[] = [];
  const remaining = [...items];
  const genreCounts = new Map<string, number>();

  while (selected.length < limit && remaining.length) {
    const index = remaining.findIndex((item) => {
      const genre = normalize(item.event.genre);
      return !genre || (genreCounts.get(genre) ?? 0) < 2 || selected.length >= 3;
    });
    const [next] = remaining.splice(index < 0 ? 0 : index, 1);
    selected.push(next);
    const genre = normalize(next.event.genre);
    if (genre) genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
  }

  return selected;
}

export function getRecommendedEvents(
  events: SpritzEvent[],
  userId: string | undefined,
  context: RecommendationContext = {},
  limit = 6,
): RecommendedEvent[] {
  const now = Date.now();
  const joinedIds = context.joinedEventIds ?? new Set<string>();
  const preferredGenres = new Set([...(context.preferredGenres ?? [])].map(normalize));

  const ranked = events
    .filter((event) => event.hostId !== userId && event.startsAt !== null)
    .filter((event) => new Date(event.startsAt!).getTime() > now)
    .filter((event) => !joinedIds.has(event.id))
    .map((event) => {
      let score = 0;
      let reason: RecommendedEvent['reason'] = 'Începe curând';
      const genre = normalize(event.genre);

      if (genre && preferredGenres.has(genre)) {
        score += RECOMMENDATION_WEIGHTS.genreMatch;
        reason = 'Potrivit pentru tine';
      }

      if (context.location) {
        const distance = distanceKm(context.location, { lat: event.lat, lng: event.lng });
        const distanceScore = Math.max(0, RECOMMENDATION_WEIGHTS.distance * (1 - Math.min(distance, 30) / 30));
        score += distanceScore;
        if (distanceScore >= RECOMMENDATION_WEIGHTS.distance * 0.65 && reason === 'Începe curând') {
          reason = 'Aproape de tine';
        }
      }

      const behaviorGenre = [...joinedIds]
        .map((id) => events.find((candidate) => candidate.id === id)?.genre)
        .filter((value): value is string => !!value)
        .map(normalize);
      if (genre && behaviorGenre.includes(genre)) {
        score += RECOMMENDATION_WEIGHTS.behavior;
        if (reason === 'Începe curând') reason = 'Potrivit pentru tine';
      }

      score += timingScore(event.startsAt!);

      const attendeeCount = context.attendeeCounts?.get(event.id);
      if (attendeeCount !== undefined && attendeeCount > 0) {
        score += Math.min(RECOMMENDATION_WEIGHTS.popularity, Math.log10(attendeeCount + 1) * 5);
        if (reason === 'Începe curând' && attendeeCount >= 5) reason = 'Popular';
      }

      return { event, score, reason };
    })
    .sort((a, b) => b.score - a.score || new Date(a.event.startsAt!).getTime() - new Date(b.event.startsAt!).getTime());

  return diversify(ranked, limit);
}
