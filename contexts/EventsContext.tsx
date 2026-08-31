import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { SpritzEvent } from '@/constants/events';
import { fetchEvents, subscribeToNewEvents } from '@/lib/events';
import { useUser } from '@/contexts/UserContext';

type EventsContextValue = {
  events: SpritzEvent[];
  addEvent: (event: SpritzEvent) => void;
  refresh: () => Promise<void>;
};

const EventsContext = createContext<EventsContextValue | null>(null);

export function EventsProvider({ children }: PropsWithChildren) {
  const { authenticated } = useUser();
  const [events, setEvents] = useState<SpritzEvent[]>([]);

  function appendIfNew(event: SpritzEvent) {
    setEvents((current) => (current.some((e) => e.id === event.id) ? current : [...current, event]));
  }

  // Gated on auth: the "events" SELECT/Realtime policy requires an
  // authenticated caller, and a Realtime channel that joins before the
  // session lands authenticates as anon and silently never gets resubscribed.
  useEffect(() => {
    if (!authenticated) {
      setEvents([]);
      return;
    }
    fetchEvents().then(setEvents);
    return subscribeToNewEvents(appendIfNew);
  }, [authenticated]);

  const value = useMemo<EventsContextValue>(
    () => ({
      events,
      // New events are appended, never inserted/reordered — MapboxMap relies
      // on the list only ever growing at the end to add just the new pin
      // instead of reloading the whole map.
      addEvent: appendIfNew,
      // Manual pull-to-reload: re-fetches the full list rather than relying
      // on Realtime, in case something was missed while disconnected.
      async refresh() {
        if (!authenticated) return;
        const fresh = await fetchEvents();
        setEvents(fresh);
      },
    }),
    [events, authenticated]
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
