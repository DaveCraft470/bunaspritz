// Placeholder people pool for the search/suggestions screen — no real social
// graph yet, so "suggested" and "friends of friends" are just tagged fake
// data rather than derived from anything.

export type SuggestedPerson = {
  id: string;
  name: string;
  emoji: string;
  /** Set for the "Sugestii" section — a past event you supposedly shared. */
  pastEventTitle?: string;
  /** Set for the "Prietenii prietenilor" section — the mutual friend. */
  viaFriend?: string;
};

export const PEOPLE_POOL: SuggestedPerson[] = [
  { id: 'p1', name: 'Mara Ionescu', emoji: '👱‍♀️', pastEventTitle: 'Seară de jazz' },
  { id: 'p2', name: 'Vlad Popescu', emoji: '🧔', pastEventTitle: 'Street food night' },
  { id: 'p3', name: 'Bianca Stan', emoji: '👩‍🦱', pastEventTitle: 'Concert acustic' },
  { id: 'p4', name: 'Ioana Marin', emoji: '👩', pastEventTitle: 'Seară la Poiana' },
  { id: 'p5', name: 'Alex Munteanu', emoji: '🧑‍🦰', viaFriend: 'Vlad' },
  { id: 'p6', name: 'Diana Radu', emoji: '👩‍🦳', viaFriend: 'Mara' },
  { id: 'p7', name: 'Cristi Dumitru', emoji: '👨', viaFriend: 'Bianca' },
  { id: 'p8', name: 'Ana Georgescu', emoji: '👩‍🦰' },
  { id: 'p9', name: 'Radu Constantin', emoji: '🧑‍🦱' },
  { id: 'p10', name: 'Elena Vasile', emoji: '👩‍🦱' },
  { id: 'p11', name: 'Mihai Barbu', emoji: '🧑' },
  { id: 'p12', name: 'Larisa Enache', emoji: '👩' },
];
