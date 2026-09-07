import { SpritzEvent } from '@/constants/events';

export const RECOMMENDATION_WEIGHTS = {
  genreMatch: 40,
  friends: 35,
  distance: 30,
  behavior: 20,
  viewedBehavior: 10,
  timing: 15,
  popularity: 10,
} as const;

export type RecommendationContext = {
  joinedEventIds?: ReadonlySet<string>;
  // "Skips" (Not Interested, Sprint 1) — excluded outright, not just down-
  // ranked, same as how Discover's main list already treats them.
  dismissedEventIds?: ReadonlySet<string>;
  // Favorite Categories (Sprint 4) — the strongest single signal, distinct
  // from behaviorally-inferred genre affinity below.
  preferredGenres?: ReadonlySet<string>;
  // Recently Viewed (Sprint 1) — a softer behavioral signal than actually
  // joining: "looked at" implies some interest, not confirmed intent.
  viewedEventIds?: ReadonlySet<string>;
  location?: { lat: number; lng: number };
  attendeeCounts?: ReadonlyMap<string, number>;
  // "N of your friends are going" (Sprint 4/5) — from
  // get_friend_attending_counts(), see lib/social.ts.
  friendAttendeeCounts?: ReadonlyMap<string, number>;
};

export type RecommendedEvent = {
  event: SpritzEvent;
  score: number;
  // Free-text now (was a fixed union) — see chooseReason below. Existing
  // renderers (app/index.tsx's RecommendationRow) just display it as-is.
  reason: string;
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('ro-RO');
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
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

// "De ce vezi acest event?" — picks the single most explanatory signal
// rather than concatenating every contributing factor. Social proof beats
// a genre match beats proximity beats popularity beats "starts soon" as a
// default, matching how compelling each reason actually reads to a person.
function chooseReason(event: SpritzEvent, genre: string, friendCount: number, genreMatched: boolean, distanceScore: number, attendeeCount: number | undefined): string {
  if (friendCount > 0) {
    return friendCount === 1 ? '1 prieten participă' : `${friendCount} prieteni participă`;
  }
  if (genreMatched && event.genre) {
    return `Pentru că îți place ${event.genre}`;
  }
  if (distanceScore >= RECOMMENDATION_WEIGHTS.distance * 0.65) {
    return 'Aproape de tine';
  }
  if (attendeeCount !== undefined && attendeeCount >= 5) {
    return 'Popular';
  }
  return 'Începe curând';
}

export function getRecommendedEvents(
  events: SpritzEvent[],
  userId: string | undefined,
  context: RecommendationContext = {},
  limit = 6,
): RecommendedEvent[] {
  const now = Date.now();
  const joinedIds = context.joinedEventIds ?? new Set<string>();
  const dismissedIds = context.dismissedEventIds ?? new Set<string>();
  const viewedIds = context.viewedEventIds ?? new Set<string>();
  const preferredGenres = new Set([...(context.preferredGenres ?? [])].map(normalize));

  const ranked = events
    .filter((event) => event.hostId !== userId && event.startsAt !== null)
    .filter((event) => new Date(event.startsAt!).getTime() > now)
    .filter((event) => !joinedIds.has(event.id) && !dismissedIds.has(event.id))
    .map((event) => {
      let score = 0;
      const genre = normalize(event.genre);

      const genreMatched = !!genre && preferredGenres.has(genre);
      if (genreMatched) score += RECOMMENDATION_WEIGHTS.genreMatch;

      let distanceScore = 0;
      if (context.location) {
        const distance = distanceKm(context.location, { lat: event.lat, lng: event.lng });
        distanceScore = Math.max(0, RECOMMENDATION_WEIGHTS.distance * (1 - Math.min(distance, 30) / 30));
        score += distanceScore;
      }

      const behaviorGenres = [...joinedIds]
        .map((id) => events.find((candidate) => candidate.id === id)?.genre)
        .filter((value): value is string => !!value)
        .map(normalize);
      if (genre && behaviorGenres.includes(genre)) {
        score += RECOMMENDATION_WEIGHTS.behavior;
      }

      const viewedGenres = [...viewedIds]
        .map((id) => events.find((candidate) => candidate.id === id)?.genre)
        .filter((value): value is string => !!value)
        .map(normalize);
      if (genre && viewedGenres.includes(genre)) {
        score += RECOMMENDATION_WEIGHTS.viewedBehavior;
      }

      score += timingScore(event.startsAt!);

      const attendeeCount = context.attendeeCounts?.get(event.id);
      if (attendeeCount !== undefined && attendeeCount > 0) {
        score += Math.min(RECOMMENDATION_WEIGHTS.popularity, Math.log10(attendeeCount + 1) * 5);
      }

      const friendCount = context.friendAttendeeCounts?.get(event.id) ?? 0;
      if (friendCount > 0) {
        score += Math.min(RECOMMENDATION_WEIGHTS.friends, friendCount * 12);
      }

      const reason = chooseReason(event, genre, friendCount, genreMatched, distanceScore, attendeeCount);

      return { event, score, reason };
    })
    .sort((a, b) => b.score - a.score || new Date(a.event.startsAt!).getTime() - new Date(b.event.startsAt!).getTime());

  return diversify(ranked, limit);
}
