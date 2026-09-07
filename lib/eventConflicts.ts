import { SpritzEvent } from '@/constants/events';

// Events have no explicit end time in the schema (just startsAt) — assume a
// typical spritz runs about this long when checking for overlap. Good enough
// for a "heads up, you're double-booked" warning; not meant to be exact.
export const ASSUMED_EVENT_DURATION_HOURS = 3;

// The first already-joined event (other than the candidate itself) whose
// assumed [start, start+duration) window overlaps the candidate's — or null
// if there's no conflict. Pure/sync so it's cheap to call right before a
// join action, no DB round-trip needed (joinedEvents is whatever's already
// loaded client-side).
export function findConflictingEvent(candidate: SpritzEvent, joinedEvents: SpritzEvent[]): SpritzEvent | null {
  if (!candidate.startsAt) return null;
  const candidateStart = new Date(candidate.startsAt).getTime();
  const candidateEnd = candidateStart + ASSUMED_EVENT_DURATION_HOURS * 60 * 60 * 1000;

  return (
    joinedEvents.find((other) => {
      if (other.id === candidate.id || !other.startsAt) return false;
      const otherStart = new Date(other.startsAt).getTime();
      const otherEnd = otherStart + ASSUMED_EVENT_DURATION_HOURS * 60 * 60 * 1000;
      return candidateStart < otherEnd && otherStart < candidateEnd;
    }) ?? null
  );
}
