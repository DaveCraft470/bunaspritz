export type Song = { title: string; artist: string; image: string | null };

export type SpritzEvent = {
  id: string;
  hostId: string;
  title: string;
  detail: string;
  emoji: string;
  color: string;
  lng: number;
  lat: number;
  genre: string;
  startsAt: string | null;
  entryFeeRon: number | null;
  drinksPriceRon: number | null;
  maxParticipants: number | null;
  locationIsRented: boolean | null;
  rentalProofPath: string | null;
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

// Takes the (possibly-grown, see EventsContext) list explicitly rather than
// reading a static seed array, since events now come entirely from Supabase.
export function getSpritzEvent(events: SpritzEvent[], id: string | undefined) {
  return events.find((event) => event.id === id);
}
