import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';

import { SPRITZ_EVENTS, type SpritzEvent } from '@/constants/events';

type EventsContextValue = {
  events: SpritzEvent[];
  addEvent: (event: SpritzEvent) => void;
};

const EventsContext = createContext<EventsContextValue | null>(null);

export function EventsProvider({ children }: PropsWithChildren) {
  const [events, setEvents] = useState<SpritzEvent[]>(SPRITZ_EVENTS);

  const value = useMemo<EventsContextValue>(
    () => ({
      events,
      // New events are appended, never inserted/reordered — MapboxMap relies
      // on the list only ever growing at the end to add just the new pin
      // instead of reloading the whole map.
      addEvent: (event) => setEvents((current) => [...current, event]),
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
