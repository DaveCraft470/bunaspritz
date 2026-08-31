import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { SpritzEvent } from '@/constants/events';
import { fetchEvents, subscribeToNewEvents } from '@/lib/events';

type EventsContextValue = {
  events: SpritzEvent[];
  addEvent: (event: SpritzEvent) => void;
};

const EventsContext = createContext<EventsContextValue | null>(null);

export function EventsProvider({ children }: PropsWithChildren) {
  const [events, setEvents] = useState<SpritzEvent[]>([]);

  function appendIfNew(event: SpritzEvent) {
    setEvents((current) => (current.some((e) => e.id === event.id) ? current : [...current, event]));
  }

  useEffect(() => {
    fetchEvents().then(setEvents);
    return subscribeToNewEvents(appendIfNew);
  }, []);

  const value = useMemo<EventsContextValue>(
    () => ({
      events,
      // New events are appended, never inserted/reordered — MapboxMap relies
      // on the list only ever growing at the end to add just the new pin
      // instead of reloading the whole map.
      addEvent: appendIfNew,
    }),
    [events]
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
