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

// Rounding to 3 decimals (~110m) plus a low zoom keeps the exact spot fuzzy —
// this is a "somewhere around here" preview, not a precise pin.
export function buildApproxStaticMapUrl(lng: number, lat: number, scheme: 'light' | 'dark', width = 640, height = 300) {
  const style = scheme === 'dark' ? STATIC_STYLE_DARK : STATIC_STYLE_LIGHT;
  const roundedLng = Math.round(lng * 1000) / 1000;
  const roundedLat = Math.round(lat * 1000) / 1000;
  return `https://api.mapbox.com/styles/v1/mapbox/${style}/static/${roundedLng},${roundedLat},13,0,0/${width}x${height}?access_token=${MAPBOX_ACCESS_TOKEN}`;
}
