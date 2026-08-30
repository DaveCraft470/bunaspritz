// Placeholder events scattered around Brașov, just so the app isn't empty —
// swap for real event/attendee data once that exists.

export type Attendee = { name: string; emoji: string };
export type Song = { title: string; artist: string; image: string | null };

export type SpritzEvent = {
  id: string;
  title: string;
  detail: string;
  emoji: string;
  color: string;
  lng: number;
  lat: number;
  attendeeCount: number;
  attendees: Attendee[];
  genre: string;
};

// Same three real tracks show up at every event — "genul de muzică ascultată"
// is the same playful trap/manele mashup no matter what the event is nominally
// about. Travis Scott and Drake have freely-licensed Wikimedia photos; Tzancă
// Uraganu doesn't have one available anywhere on Wikidata/Wikipedia/Commons,
// so he falls back to a styled avatar instead of a broken image.
export const SPRITZ_SONGS: Song[] = [
  {
    title: 'SICKO MODE',
    artist: 'Travis Scott',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/TravisScott-byPhilipRomano.jpg/500px-TravisScott-byPhilipRomano.jpg',
  },
  {
    title: "God's Plan",
    artist: 'Drake',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Drake_July_2016.jpg/500px-Drake_July_2016.jpg',
  },
  {
    title: 'Cadillac cu volan pe dreapta',
    artist: 'Tzancă Uraganu',
    image: null,
  },
];

const ATTENDEE_POOL: Attendee[] = [
  { name: 'Andrei', emoji: '🧑' },
  { name: 'Ioana', emoji: '👩' },
  { name: 'Vlad', emoji: '🧔' },
  { name: 'Mara', emoji: '👱‍♀️' },
  { name: 'Bianca', emoji: '👩‍🦱' },
  { name: 'Alex', emoji: '🧑‍🦰' },
  { name: 'Diana', emoji: '👩‍🦳' },
  { name: 'Cristi', emoji: '👨' },
  { name: 'Ana', emoji: '👩‍🦰' },
  { name: 'Radu', emoji: '🧑‍🦱' },
];

function attendeesFor(...indexes: number[]): Attendee[] {
  return indexes.map((i) => ATTENDEE_POOL[i]);
}

export const SPRITZ_EVENTS: SpritzEvent[] = [
  {
    id: 'jazz',
    title: 'Seară de jazz',
    detail: 'Curtea Muzeului · 20:00',
    emoji: '🎷',
    color: '#FF9F5A',
    lng: 25.6203,
    lat: 45.646,
    attendeeCount: 18,
    attendees: attendeesFor(0, 1, 2, 3, 4),
    genre: 'Trap & manele (surprinzător, pentru o "seară de jazz")',
  },
  {
    id: 'picnic',
    title: 'Picnic în parc',
    detail: 'Parcul Central · 17:30',
    emoji: '🧺',
    color: '#5FD98A',
    lng: 25.6122,
    lat: 45.6501,
    attendeeCount: 9,
    attendees: attendeesFor(1, 3, 5, 6),
    genre: 'Chill trap & manele de picnic',
  },
  {
    id: 'hike',
    title: 'Drumeție pe Tâmpa',
    detail: 'Telecabină · 09:00',
    emoji: '🥾',
    color: '#5AA9E6',
    lng: 25.5975,
    lat: 45.638,
    attendeeCount: 12,
    attendees: attendeesFor(2, 4, 6, 7, 8),
    genre: 'Hip-hop de urcat munte',
  },
  {
    id: 'poiana',
    title: 'Seară la Poiana',
    detail: 'Poiana Brașov · 19:00',
    emoji: '🍻',
    color: '#FFD25A',
    lng: 25.556,
    lat: 45.594,
    attendeeCount: 27,
    attendees: attendeesFor(0, 2, 3, 5, 7, 9),
    genre: 'Trap, manele și tot ce se cântă la Spritz',
  },
  {
    id: 'food',
    title: 'Street food night',
    detail: 'Piața Sfatului · 18:00',
    emoji: '🌮',
    color: '#FF6B81',
    lng: 25.591,
    lat: 45.6427,
    attendeeCount: 15,
    attendees: attendeesFor(1, 4, 5, 8, 9),
    genre: 'Manele cu tot cu mici',
  },
  {
    id: 'music',
    title: 'Concert acustic',
    detail: 'Grădina de vară · 21:00',
    emoji: '🎸',
    color: '#B388FF',
    lng: 25.628,
    lat: 45.6505,
    attendeeCount: 21,
    attendees: attendeesFor(0, 3, 6, 7),
    genre: '"Acustic" până la miezul nopții, apoi manele',
  },
  {
    id: 'games',
    title: 'Board games meetup',
    detail: 'Cafenea centrală · 18:30',
    emoji: '🎲',
    color: '#4ED9C9',
    lng: 25.6055,
    lat: 45.652,
    attendeeCount: 7,
    attendees: attendeesFor(2, 5, 8),
    genre: 'Lo-fi... care se transformă rapid în manele',
  },
];

export function getSpritzEvent(id: string | undefined) {
  return SPRITZ_EVENTS.find((event) => event.id === id);
}
