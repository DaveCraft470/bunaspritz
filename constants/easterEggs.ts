// Hidden map pins that are NOT real Spritz events — never merged into the
// `events` array from EventsContext, so they can't be counted by the "X
// evenimente azi" caption under the logo or by any event-tracking screen
// (my-events, admin-events, discover, etc). Rendered by MapboxMap as extra
// markers with their own click handling instead.
export type EasterEggPin = {
  id: string;
  title: string;
  emoji: string;
  color: string;
  lng: number;
  lat: number;
  // ISO string, no timezone suffix — treated the same as SpritzEvent.startsAt.
  happensAt: string;
};

export const EASTER_EGG_PINS: EasterEggPin[] = [
  {
    id: 'easter-egg-antarctica',
    title: 'Brr, ce cauti aici?',
    emoji: '🐧',
    color: '#3AA0FF',
    lng: 0,
    lat: -82,
    happensAt: '2078-04-28T09:00:00',
  },
];
