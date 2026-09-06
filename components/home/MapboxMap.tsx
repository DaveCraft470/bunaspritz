import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { router } from 'expo-router';

import {
  MAP_LOAD_TIMEOUT_MS,
  MAPBOX_ACCESS_TOKEN,
  MAPBOX_GL_JS_VERSION,
  MAPBOX_INITIAL_VIEW,
  MAPBOX_STYLE_URL_DARK,
  MAPBOX_STYLE_URL_LIGHT,
  MAPLIBRE_GL_JS_VERSION,
  OPENFREEMAP_STYLE_URL,
} from '@/constants/mapbox';
import type { SpritzEvent } from '@/constants/events';
import { useAppTheme } from '@/contexts/ThemeContext';
import { FakeMapBackdrop } from './FakeMapBackdrop';

const LOAD_TIMEOUT_MS = MAP_LOAD_TIMEOUT_MS;

type Provider = 'mapbox' | 'maplibre';

// Sticky across remounts (theme toggle, pull-to-refresh reload) — once
// Mapbox has proven unreachable/broken this app session, skip straight to
// the spare map next time instead of re-probing a dead service and making
// the user sit through another LOAD_TIMEOUT_MS. Native-only counterpart to
// lib/mapboxGlWeb.ts's markMapboxDead/isMapboxKnownDead (separate JS
// runtime from the web build, so it can't share that module's state).
let mapboxKnownDead = false;

type PinData = Pick<SpritzEvent, 'id' | 'emoji' | 'color' | 'lng' | 'lat' | 'source'>;

type PinWithStory = PinData & { hasStories: boolean };

function toPinData(events: SpritzEvent[], storyEventIds?: Set<string>): PinWithStory[] {
  return events.map((e) => ({
    id: e.id,
    emoji: e.emoji,
    color: e.color,
    lng: e.lng,
    lat: e.lat,
    source: e.source,
    hasStories: storyEventIds?.has(e.id) ?? false,
  }));
}

// `provider` picks the whole library + style + token combo — see
// MAPLIBRE_GL_JS_VERSION/OPENFREEMAP_STYLE_URL in constants/mapbox.ts for why
// the fallback is a different library, not just a different style URL
// (`mapbox://styles/...` is a proprietary scheme MapLibre can't resolve).
// Everything past that (markers, pins, camera) uses `gl`/`window.mapboxgl ||
// window.maplibregl`, since MapLibre GL JS is API-compatible with the
// Mapbox GL JS APIs this app touches.
function buildHtml(provider: Provider, styleUrl: string, initialEvents: PinData[]) {
  const libCssUrl =
    provider === 'mapbox'
      ? `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_JS_VERSION}/mapbox-gl.css`
      : `https://unpkg.com/maplibre-gl@${MAPLIBRE_GL_JS_VERSION}/dist/maplibre-gl.css`;
  const libScriptUrl =
    provider === 'mapbox'
      ? `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_JS_VERSION}/mapbox-gl.js`
      : `https://unpkg.com/maplibre-gl@${MAPLIBRE_GL_JS_VERSION}/dist/maplibre-gl.js`;
  // Only meaningful for Mapbox itself — OpenFreeMap needs no token, and a
  // network probe against api.mapbox.com would tell us nothing about it.
  const tokenAndProbeScript =
    provider === 'mapbox'
      ? `
    gl.accessToken = '${MAPBOX_ACCESS_TOKEN}';
    (function () {
      var ctrl = new AbortController();
      var timer = setTimeout(function () { ctrl.abort(); }, 5000);
      fetch('https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${MAPBOX_ACCESS_TOKEN}', { signal: ctrl.signal })
        .then(function (r) { clearTimeout(timer); send('debug:network probe status ' + r.status); })
        .catch(function (err) { clearTimeout(timer); send('debug:network probe failed ' + (err && err.message ? err.message : String(err))); });
    })();`
      : '';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no" />
  <link href="${libCssUrl}" rel="stylesheet" />
  <style>
    html, body, #map { position: absolute; inset: 0; margin: 0; padding: 0; }
    .event-pin {
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
    .event-pin span {
      display: block;
      transform: rotate(45deg);
      font-size: 17px;
    }
    .event-pin.story-pin::after {
      content: '';
      position: absolute;
      inset: -5px;
      border: 2px solid #1FD460;
      border-radius: 50%;
    }
    /* Scraped events (source === 'scraper', pulled in from zilesinopti.ro)
       get a shape of their own — a rounded square badge with a dashed
       border, floating centered on its coordinate rather than pointing down
       at one — so they never read as a host's own hosted Spritz at a glance,
       even at a distance or a quick look. */
    .scraper-event-pin {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 3px 10px rgba(0,0,0,0.35);
      border: 2px dashed rgba(255,255,255,0.92);
      cursor: pointer;
    }
    .scraper-event-pin span {
      display: block;
      font-size: 16px;
    }
    .user-pin {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #2F86FF;
      border: 3px solid #FFFFFF;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      position: relative;
    }
    .user-pin::after {
      content: '';
      position: absolute;
      inset: -12px;
      border-radius: 50%;
      background: rgba(47,134,255,0.35);
      animation: user-pin-pulse 1.8s ease-out infinite;
    }
    @keyframes user-pin-pulse {
      0% { transform: scale(0.4); opacity: 0.9; }
      100% { transform: scale(1.6); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="${libScriptUrl}"></script>
  <script>
    function send(message) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(message);
    }
    window.onerror = function (msg) { send('debug:window.onerror ' + msg); };
    document.addEventListener('webglcontextcreationerror', function (e) {
      send('error:webglcontextcreationerror ' + (e.statusMessage || 'unknown'));
    }, false);
    var gl = window.mapboxgl || window.maplibregl;
    send('debug:script running, provider=${provider}, gl=' + (typeof gl) + ', webgl2=' + !!document.createElement('canvas').getContext('webgl2'));
    ${tokenAndProbeScript}
    try {
      var map = new gl.Map({
        container: 'map',
        style: '${styleUrl}',
        center: [${MAPBOX_INITIAL_VIEW.center[0]}, ${MAPBOX_INITIAL_VIEW.center[1]}],
        zoom: ${MAPBOX_INITIAL_VIEW.zoom},
        bearing: ${MAPBOX_INITIAL_VIEW.bearing},
        pitch: ${MAPBOX_INITIAL_VIEW.pitch},
      });
      send('debug:map constructed');
      function addEventPin(ev) {
        var isScraped = ev.source === 'scraper';
        var el = document.createElement('div');
        el.className = isScraped ? 'scraper-event-pin' : ('event-pin' + (ev.hasStories ? ' story-pin' : ''));
        el.style.background = ev.color;
        el.innerHTML = '<span>' + ev.emoji + '</span>';
        el.addEventListener('click', function () {
          var p = map.project([ev.lng, ev.lat]);
          send('event:' + ev.id + ':' + Math.round(p.x) + ':' + Math.round(p.y));
        });
        new gl.Marker({ element: el, anchor: isScraped ? 'center' : 'bottom' })
          .setLngLat([ev.lng, ev.lat])
          .addTo(map);
      }
      // Exposed so a newly-created event can get a pin without reloading the
      // whole map — see MapboxMap's effect watching the events prop grow.
      window.__addEventPin = addEventPin;
      map.on('load', function () {
        send('loaded');
        var events = ${JSON.stringify(initialEvents)};
        events.forEach(addEventPin);
      });
      map.on('idle', function () { send('debug:idle'); });
      // 'dragstart' only fires for an actual touch/mouse drag, not for our
      // own programmatic flyTo — so this is exactly "the user moved the map
      // away themselves" as opposed to us moving it for them.
      map.on('dragstart', function () { send('userpanned'); });
      map.on('error', function (e) {
        var msg = (e && e.error && e.error.message) || JSON.stringify(e && e.error) || 'unknown';
        send('error:' + msg);
      });

      var userMarker = null;
      function ensureUserMarker(lng, lat) {
        if (!userMarker) {
          var el = document.createElement('div');
          el.className = 'user-pin';
          userMarker = new gl.Marker({ element: el });
          userMarker.setLngLat([lng, lat]).addTo(map);
        } else {
          userMarker.setLngLat([lng, lat]);
        }
      }
      // Placed passively (no camera movement) as soon as we have a fix, so the
      // dot is already on the map before the user ever presses the locate button.
      window.__placeUser = function (lng, lat) {
        ensureUserMarker(lng, lat);
      };
      window.__flyToUser = function (lng, lat) {
        ensureUserMarker(lng, lat);
        map.flyTo({
          center: [lng, lat],
          zoom: 16,
          pitch: 40,
          bearing: 0,
          speed: 0.85,
          curve: 1.3,
          essential: true,
        });
        map.once('moveend', function () { send('located'); });
      };
    } catch (e) {
      send('error:' + (e && e.message ? e.message : String(e)));
    }
  </script>
</body>
</html>`;
}

type Status = 'loading' | 'ready' | 'error';

export type MapboxMapHandle = {
  flyToLocation: (lng: number, lat: number) => void;
  placeUserLocation: (lng: number, lat: number) => void;
  reload: () => void;
};

type MapboxMapProps = {
  events: SpritzEvent[];
  storyEventIds?: Set<string>;
  onOpenStories?: (eventId: string) => void;
  onReady?: () => void;
  onLocated?: () => void;
  onUserPanned?: () => void;
  onError?: () => void;
};

export const MapboxMap = forwardRef<MapboxMapHandle, MapboxMapProps>(function MapboxMap(
  { events, storyEventIds, onOpenStories, onReady, onLocated, onUserPanned, onError },
  ref
) {
  const { scheme } = useAppTheme();
  const styleUrl = scheme === 'dark' ? MAPBOX_STYLE_URL_DARK : MAPBOX_STYLE_URL_LIGHT;
  // Once Mapbox has proven dead this app session, skip straight to the spare
  // map on every later mount instead of re-probing a service that just
  // failed and making the user sit through another LOAD_TIMEOUT_MS.
  const [provider, setProvider] = useState<Provider>(() => (mapboxKnownDead ? 'maplibre' : 'mapbox'));
  // OpenFreeMap has no dark variant of its own (see OPENFREEMAP_STYLE_URL) —
  // this collapses to a constant once in fallback mode, so a theme toggle
  // while degraded doesn't rebuild (and re-flash) the fallback map.
  const effectiveStyleUrl = provider === 'mapbox' ? styleUrl : OPENFREEMAP_STYLE_URL;
  // Bumped by the explicit reload() below — the only other things that force
  // a rebuild are the theme swapping styles and a provider fallback.
  // Deliberately NOT reactive to `events` growing on its own, since a full
  // reload per new event would be exactly the costly reload the user wants
  // avoided; a manual reload, though, should embed whatever `events`
  // currently holds, not a stale snapshot from first mount — that's what
  // `reloadNonce` is for.
  const [reloadNonce, setReloadNonce] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(
    () => buildHtml(provider, effectiveStyleUrl, toPinData(events, storyEventIds)),
    [provider, effectiveStyleUrl, reloadNonce, storyEventIds]
  );
  const webviewRef = useRef<WebView>(null);
  const knownEventCountRef = useRef(events.length);

  const [status, setStatus] = useState<Status>('loading');
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  // One-shot per attempt (see the html-keyed effect below, which resets this
  // for every new build) — without it, a late/duplicate failure signal (a
  // stale timeout firing after an 'error:' message already acted, or the
  // reverse) could re-trigger the fallback logic after it's already resolved
  // one way or the other.
  const settledRef = useRef(false);

  function handleFailure(reason: string) {
    if (settledRef.current) return;
    settledRef.current = true;
    if (provider === 'mapbox') {
      const breadcrumb = 'debug:Mapbox failed (' + reason + '), falling back to MapLibre/OpenFreeMap';
      if (__DEV__) console.log('[MapboxMap]', breadcrumb);
      setLastMessage(breadcrumb);
      mapboxKnownDead = true;
      setProvider('maplibre');
      // Deliberately not setStatus('error') here — the html-keyed effect
      // below fires again for the maplibre rebuild and this stays 'loading'
      // (and FakeMapBackdrop stays up) until that attempt resolves.
    } else {
      const breadcrumb = 'debug:MapLibre fallback also failed (' + reason + ')';
      if (__DEV__) console.log('[MapboxMap]', breadcrumb);
      setLastMessage(breadcrumb);
      setStatus('error');
      onError?.();
    }
  }

  // A new event appended after the map already loaded gets its pin injected
  // directly instead of waiting for (or forcing) a reload.
  useEffect(() => {
    if (events.length > knownEventCountRef.current) {
      const newOnes = events.slice(knownEventCountRef.current);
      for (const pin of toPinData(newOnes, storyEventIds)) {
        webviewRef.current?.injectJavaScript(
          `window.__addEventPin && window.__addEventPin(${JSON.stringify(pin)}); true;`
        );
      }
    }
    knownEventCountRef.current = events.length;
  }, [events, storyEventIds]);

  // Whenever html actually rebuilds from a fresh reload (not from events
  // growing — see above), the new HTML embeds `events` as of THIS render, so
  // the catch-up count needs to match that same snapshot, not be reset from
  // inside the imperative reload() call below, which runs a render earlier.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    knownEventCountRef.current = events.length;
  }, [reloadNonce]);

  useImperativeHandle(ref, () => ({
    flyToLocation(lng: number, lat: number) {
      webviewRef.current?.injectJavaScript(
        `window.__flyToUser && window.__flyToUser(${lng}, ${lat}); true;`
      );
    },
    placeUserLocation(lng: number, lat: number) {
      webviewRef.current?.injectJavaScript(
        `window.__placeUser && window.__placeUser(${lng}, ${lat}); true;`
      );
    },
    // The explicit "classic" reload — swipe-down from the header, not
    // triggered automatically on remount (see the effect above). Rebuilds
    // `html` (via reloadNonce) instead of calling the WebView's own
    // .reload(), which would just re-run the stale HTML from first mount.
    // Rebuilds whichever provider is currently active — a pull-to-refresh
    // isn't a request to re-probe a Mapbox that's already known dead.
    reload() {
      setReloadNonce((n) => n + 1);
    },
  }));

  // Every new attempt (theme swap, explicit reload, or a provider fallback
  // — anything that changes `html`) gets its own load-timeout window and its
  // own settled latch, so a stale timer from a previous, already-resolved
  // attempt can't fire handleFailure again for an attempt that already
  // succeeded or failed a different way.
  useEffect(() => {
    setStatus('loading');
    settledRef.current = false;
    const timer = setTimeout(() => handleFailure('load timeout'), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  const handleMessage = (event: WebViewMessageEvent) => {
    const data = event.nativeEvent.data;
    // Was unconditional — spamming every map load/tap/pan in production too,
    // when lastMessage below (what this was actually for) is already __DEV__-only.
    if (__DEV__) console.log('[MapboxMap]', data);
    setLastMessage(data);
    if (data === 'loaded') {
      settledRef.current = true;
      setStatus('ready');
      onReady?.();
    } else if (data.startsWith('error:')) {
      // A tile 404 or transient network blip after the map is already up
      // isn't worth tearing down a working map (or falling back) over.
      if (status !== 'ready') handleFailure(data.slice('error:'.length));
    } else if (data.startsWith('event:')) {
      const [, id, originX, originY] = data.split(':');
      if (storyEventIds?.has(id)) onOpenStories?.(id);
      else router.push({ pathname: '/event/[id]', params: { id, originX, originY } });
    } else if (data === 'located') {
      onLocated?.();
    } else if (data === 'userpanned') {
      onUserPanned?.();
    }
  };

  return (
    <>
      {/* Sits underneath the real map at all times — the WebView's
          transparent background lets it show through until tiles paint
          over it, and it stays as the fallback if the real map errors out. */}
      <FakeMapBackdrop />
      <WebView
        ref={webviewRef}
        source={{ html, baseUrl: 'https://localhost' }}
        style={styles.webview}
        androidLayerType="hardware"
        onMessage={handleMessage}
        onError={(e) => {
          setLastMessage('webview:onError ' + JSON.stringify(e.nativeEvent));
          handleFailure('webview:onError');
        }}
        onHttpError={(e) => {
          setLastMessage('webview:onHttpError ' + JSON.stringify(e.nativeEvent));
          handleFailure('webview:onHttpError');
        }}
      />
      {__DEV__ && status !== 'ready' && lastMessage ? (
        <Text style={styles.debugText}>{lastMessage}</Text>
      ) : null}
    </>
  );
});

const styles = StyleSheet.create({
  webview: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  debugText: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.7)',
    fontSize: 11,
    padding: 6,
    borderRadius: 6,
  },
});
