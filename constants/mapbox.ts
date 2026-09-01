// Public runtime token — safe to embed client-side, this is how Mapbox's own
// GL JS docs use it. Do not confuse with a "downloads" token (not needed here
// since we load the map via GL JS in a WebView, not the native SDK).
export const MAPBOX_ACCESS_TOKEN =
  'pk.eyJ1IjoiYnVuYXNwcml0eiIsImEiOiJjbXRlYW5qbjUweW1zMnhzNnBvbjFmd3pkIn0.43cMI-Nx9TIZ2lVEZ_Fh_Q';

// "Faded" (light mode) and "Faded-copy" (dark mode) — two style variants
// authored in Mapbox Studio under the same account.
export const MAPBOX_STYLE_URL_LIGHT = 'mapbox://styles/bunaspritz/cmtebbgci004y01qt58kg26pg';
export const MAPBOX_STYLE_URL_DARK = 'mapbox://styles/bunaspritz/cmteckrhm002o01s5cyw53dqv';

export const MAPBOX_GL_JS_VERSION = '3.27.0';

export const MAPBOX_INITIAL_VIEW = {
  center: [25.6105235817314, 45.64881722195011] as [number, number],
  zoom: 12.5,
  bearing: -131.25520763244685,
  pitch: 60.15495229720443,
};

// Plain public Mapbox styles for the small static preview on the event detail
// screen — the custom "Faded" 3D Standard style is built for interactive
// GL JS and isn't a safe bet through the Static Images API.
const STATIC_STYLE_LIGHT = 'light-v11';
const STATIC_STYLE_DARK = 'dark-v11';

// Deterministic per-seed "random" in [0, 1) — same seed always fuzzes the
// same way, so a given event's circle doesn't jump around between renders,
// but two different events (even at the same real spot) fuzz independently.
function seededRandom(seed: string) {
  let state = 0;
  for (let i = 0; i < seed.length; i++) {
    state = (state << 5) - state + seed.charCodeAt(i);
    state |= 0;
  }
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

const FUZZ_RADIUS_METERS = 350;
const METERS_PER_DEGREE_LAT = 111320;

// Offsets a coordinate by up to FUZZ_RADIUS_METERS in a seed-derived random
// direction, uniformly over the disk (not the annulus — sqrt(rand), not
// rand, so points don't cluster near the edge).
function fuzzCoords(lng: number, lat: number, seed: string): { lng: number; lat: number } {
  const rand = seededRandom(seed);
  const angle = rand() * Math.PI * 2;
  const distance = FUZZ_RADIUS_METERS * Math.sqrt(rand());
  const latOffset = (distance * Math.cos(angle)) / METERS_PER_DEGREE_LAT;
  const lngOffset = (distance * Math.sin(angle)) / (METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));
  return { lng: lng + lngOffset, lat: lat + latOffset };
}

// Rounding to 3 decimals (~110m) plus a low zoom keeps the exact spot fuzzy.
// Pass fuzzSeed (the event id) when this is shown to *other* people — the
// circle overlay UI draws its dot dead-center on this coordinate, so without
// a real random offset the "approximate" location was, in practice, exact:
// centered within ~110m of the real spot every time. Omit fuzzSeed for the
// host's own creation-flow preview, where they need to see exactly where
// they placed the pin.
export function buildApproxStaticMapUrl(
  lng: number,
  lat: number,
  scheme: 'light' | 'dark',
  width = 640,
  height = 300,
  fuzzSeed?: string
) {
  const style = scheme === 'dark' ? STATIC_STYLE_DARK : STATIC_STYLE_LIGHT;
  const { lng: fuzzedLng, lat: fuzzedLat } = fuzzSeed ? fuzzCoords(lng, lat, fuzzSeed) : { lng, lat };
  const roundedLng = Math.round(fuzzedLng * 1000) / 1000;
  const roundedLat = Math.round(fuzzedLat * 1000) / 1000;
  return `https://api.mapbox.com/styles/v1/mapbox/${style}/static/${roundedLng},${roundedLat},13,0,0/${width}x${height}?access_token=${MAPBOX_ACCESS_TOKEN}`;
}
