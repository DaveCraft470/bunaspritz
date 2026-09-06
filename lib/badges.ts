// Trophy definitions computed client-side from stats the app already tracks
// (profile.tsx already loads friend count, event stats and verification
// status for its own cards) — no new backend table needed just to render a
// progress bar over numbers that already exist.
export type BadgeStats = { attended: number; hosted: number; friends: number; verified: boolean };

export type Badge = {
  id: string;
  emoji: string;
  title: string;
  howTo: string;
  target: number | null; // null = boolean unlock (no progress bar), e.g. verification
  current: (stats: BadgeStats) => number;
  unlocked: (stats: BadgeStats) => boolean;
};

export const BADGES: Badge[] = [
  {
    id: 'verified',
    emoji: '🛡️',
    title: 'Verificat',
    howTo: 'Verifică-ți identitatea și vârsta din Setări → Verificare identitate.',
    target: null,
    current: (s) => (s.verified ? 1 : 0),
    unlocked: (s) => s.verified,
  },
  {
    id: 'first-event',
    emoji: '🎉',
    title: 'Prima ieșire',
    howTo: 'Participă și confirmă prezența (check-in) la primul tău eveniment Spritz.',
    target: 1,
    current: (s) => s.attended,
    unlocked: (s) => s.attended >= 1,
  },
  {
    id: 'regular',
    emoji: '🍹',
    title: 'Client fidel',
    howTo: 'Confirmă prezența la 5 evenimente Spritz.',
    target: 5,
    current: (s) => s.attended,
    unlocked: (s) => s.attended >= 5,
  },
  {
    id: 'legend',
    emoji: '👑',
    title: 'Legendă Spritz',
    howTo: 'Confirmă prezența la 15 evenimente Spritz.',
    target: 15,
    current: (s) => s.attended,
    unlocked: (s) => s.attended >= 15,
  },
  {
    id: 'host',
    emoji: '🎪',
    title: 'Prima gazdă',
    howTo: 'Organizează primul tău eveniment din butonul „Adaugă eveniment nou”.',
    target: 1,
    current: (s) => s.hosted,
    unlocked: (s) => s.hosted >= 1,
  },
  {
    id: 'super-host',
    emoji: '🌟',
    title: 'Gazdă de nota 10',
    howTo: 'Organizează 5 evenimente.',
    target: 5,
    current: (s) => s.hosted,
    unlocked: (s) => s.hosted >= 5,
  },
  {
    id: 'friendly',
    emoji: '🤝',
    title: 'Sociabil',
    howTo: 'Adaugă 3 prieteni din tab-ul Prieteni.',
    target: 3,
    current: (s) => s.friends,
    unlocked: (s) => s.friends >= 3,
  },
  {
    id: 'popular',
    emoji: '🦋',
    title: 'Fluture social',
    howTo: 'Ajunge la 10 prieteni.',
    target: 10,
    current: (s) => s.friends,
    unlocked: (s) => s.friends >= 10,
  },
  {
    id: 'networker',
    emoji: '🌐',
    title: 'Regele rețelei',
    howTo: 'Ajunge la 25 de prieteni.',
    target: 25,
    current: (s) => s.friends,
    unlocked: (s) => s.friends >= 25,
  },
];
