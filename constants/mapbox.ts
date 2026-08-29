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
  zoom: 16.24198898476121,
  bearing: -131.25520763244685,
  pitch: 60.15495229720443,
};
