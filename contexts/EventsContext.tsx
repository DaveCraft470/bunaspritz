import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { SpritzEvent } from '@/constants/events';
import { fetchEvents, subscribeToDeletedEvents, subscribeToNewEvents } from '@/lib/events';
import { useUser } from '@/contexts/UserContext';

type EventsContextValue = {
  events: SpritzEvent[];
  loading: boolean;
  error: boolean;
  addEvent: (event: SpritzEvent) => void;
  updateEvent: (event: SpritzEvent) => void;
  removeEvent: (eventId: string) => void;
  refresh: () => Promise<void>;
};

const EventsContext = createContext<EventsContextValue | null>(null);

export function EventsProvider({ children }: PropsWithChildren) {
  const { authenticated } = useUser();
  const [events, setEvents] = useState<SpritzEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function appendIfNew(event: SpritzEvent) {
    setEvents((current) => (current.some((e) => e.id === event.id) ? current : [...current, event]));
  }

  function removeById(eventId: string) {
    setEvents((current) => current.filter((e) => e.id !== eventId));
  }

  // Gated on auth: the "events" SELECT/Realtime policy requires an
  // authenticated caller, and a Realtime channel that joins before the
  // session lands authenticates as anon and silently never gets resubscribed.
  useEffect(() => {
    if (!authenticated) {
      setEvents([]);
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    fetchEvents()
      .then(setEvents)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
    const unsubscribeInserts = subscribeToNewEvents(appendIfNew);
    // Otherwise a host cancelling their own event only disappears locally
    // for that host — everyone else with the map/list already loaded keeps
    // seeing the stale pin/entry until they manually pull to refresh.
    const unsubscribeDeletes = subscribeToDeletedEvents(removeById);
    return () => {
      unsubscribeInserts();
      unsubscribeDeletes();
    };
  }, [authenticated]);

  const value = useMemo<EventsContextValue>(
    () => ({
      events,
      loading,
      error,
      // New events are appended, never inserted/reordered — MapboxMap relies
      // on the list only ever growing at the end to add just the new pin
      // instead of reloading the whole map.
      addEvent: appendIfNew,
      updateEvent(event: SpritzEvent) {
        setEvents((current) => current.map((existing) => (existing.id === event.id ? event : existing)));
      },
      // A host cancelling their own event — drops it locally right away
      // instead of waiting on a refetch, matching addEvent's local-first idiom.
      removeEvent: removeById,
      // Manual pull-to-reload: re-fetches the full list rather than relying
      // on Realtime, in case something was missed while disconnected.
      async refresh() {
        if (!authenticated) return;
        setLoading(true);
        setError(false);
        try {
          const fresh = await fetchEvents();
          setEvents(fresh);
        } catch {
          setError(true);
        } finally {
          setLoading(false);
        }
      },
    }),
    [events, authenticated, loading, error]
  );

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}

export function useEvents() {
  const ctx = useContext(EventsContext);
  if (!ctx) {
    throw new Error('useEvents must be used within an EventsProvider');
  }
  return ctx;
}
