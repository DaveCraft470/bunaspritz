// Web-only: loads Mapbox GL JS from the same CDN the native build's WebView
// HTML pulls it from, so there's exactly one place tracking the version/URLs
// (see constants/mapbox.ts). Native renders the map inside a WebView because
// there's no first-party Mapbox SDK wired up here; on web there's no WebView
// at all (react-native-webview throws "does not support this platform"), so
// MapboxMap.web.tsx and LocationPickerModal.web.tsx mount Mapbox GL JS
// straight into a real DOM node instead.
import { MAPBOX_GL_JS_VERSION, MAPLIBRE_GL_JS_VERSION } from '@/constants/mapbox';

declare global {
  interface Window {
    mapboxgl?: any;
    maplibregl?: any;
  }
}

const PIN_STYLE_ID = 'spritz-mapbox-pin-styles';

// The event/user pin CSS from the WebView HTML, ported to a real stylesheet
// since there's no per-map <head> to embed it in here — injected once and
// shared by every map instance on the page.
const PIN_STYLES = `
.spritz-event-pin {
  width: 36px;
  height: 36px;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 3px 10px rgba(0,0,0,0.35);
  border: 2px solid rgba(255,255,255,0.92);
  cursor: pointer;
}
.spritz-event-pin span {
  display: block;
  transform: rotate(45deg);
  font-size: 17px;
}
.spritz-user-pin {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #2F86FF;
  border: 3px solid #FFFFFF;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  position: relative;
}
.spritz-user-pin::after {
  content: '';
  position: absolute;
  inset: -12px;
  border-radius: 50%;
  background: rgba(47,134,255,0.35);
  animation: spritz-user-pin-pulse 1.8s ease-out infinite;
}
@keyframes spritz-user-pin-pulse {
  0% { transform: scale(0.4); opacity: 0.9; }
  100% { transform: scale(1.6); opacity: 0; }
}
`;

function ensurePinStyles() {
  if (document.getElementById(PIN_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PIN_STYLE_ID;
  style.textContent = PIN_STYLES;
  document.head.appendChild(style);
}

let loadPromise: Promise<any> | null = null;

// Idempotent and shared across every caller on the page — the script/CSS
// tags are only ever injected once, no matter how many maps mount.
export function loadMapboxGl(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('mapbox-gl requires a browser environment'));
  if (window.mapboxgl) return Promise.resolve(window.mapboxgl);
  if (loadPromise) return loadPromise;

  ensurePinStyles();

  loadPromise = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_JS_VERSION}/mapbox-gl.css`;
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_JS_VERSION}/mapbox-gl.js`;
    script.async = true;
    script.onload = () => {
      if (window.mapboxgl) resolve(window.mapboxgl);
      else reject(new Error('mapbox-gl.js loaded but did not define window.mapboxgl'));
    };
    script.onerror = () => reject(new Error('Failed to load mapbox-gl.js'));
    document.head.appendChild(script);
  });

  return loadPromise;
}

let maplibreLoadPromise: Promise<any> | null = null;

// The spare-map library — see OPENFREEMAP_STYLE_URL in constants/mapbox.ts
// for why. Same shape as loadMapboxGl above; kept as a separate script/CSS
// pair (and a separate global, `maplibregl`) since a page can end up with
// both loaded — one map already showing Mapbox while the other falls back.
export function loadMapLibreGl(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('maplibre-gl requires a browser environment'));
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (maplibreLoadPromise) return maplibreLoadPromise;

  ensurePinStyles();

  maplibreLoadPromise = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://unpkg.com/maplibre-gl@${MAPLIBRE_GL_JS_VERSION}/dist/maplibre-gl.css`;
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = `https://unpkg.com/maplibre-gl@${MAPLIBRE_GL_JS_VERSION}/dist/maplibre-gl.js`;
    script.async = true;
    script.onload = () => {
      if (window.maplibregl) resolve(window.maplibregl);
      else reject(new Error('maplibre-gl.js loaded but did not define window.maplibregl'));
    };
    script.onerror = () => reject(new Error('Failed to load maplibre-gl.js'));
    document.head.appendChild(script);
  });

  return maplibreLoadPromise;
}

// Sticky across remounts (theme toggle, pull-to-refresh, tab switching) —
// once Mapbox has proven unreachable/broken this page load, every later
// MapboxMap mount should go straight to the spare map instead of re-probing
// a dead service and making the user sit through another 10s timeout first.
let mapboxDead = false;

export function isMapboxKnownDead() {
  return mapboxDead;
}

export function markMapboxDead() {
  mapboxDead = true;
}
