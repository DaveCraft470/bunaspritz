import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import {
  MAP_LOAD_TIMEOUT_MS,
  MAPBOX_ACCESS_TOKEN,
  MAPBOX_INITIAL_VIEW,
  MAPBOX_STYLE_URL_DARK,
  MAPBOX_STYLE_URL_LIGHT,
  OPENFREEMAP_STYLE_URL,
} from '@/constants/mapbox';
import type { SpritzEvent } from '@/constants/events';
import { EASTER_EGG_PINS } from '@/constants/easterEggs';
import { showAlert } from '@/lib/alert';
import { useAppTheme } from '@/contexts/ThemeContext';
import { isMapboxKnownDead, loadMapboxGl, loadMapLibreGl, markMapboxDead } from '@/lib/mapboxGlWeb';
import { FakeMapBackdrop } from './FakeMapBackdrop';

// Same formatting as MapboxMap.tsx (native) — kept separate since the two
// files don't share a module otherwise.
function formatEasterEggDate(happensAt: string) {
  const date = new Date(happensAt);
  const datePart = date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
  const timePart = date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

type Provider = 'mapbox' | 'maplibre';

type PinData = Pick<SpritzEvent, 'id' | 'emoji' | 'color' | 'lng' | 'lat'>;

function toPinData(events: SpritzEvent[]): PinData[] {
  return events.map((e) => ({ id: e.id, emoji: e.emoji, color: e.color, lng: e.lng, lat: e.lat }));
}

export type MapboxMapHandle = {
  flyToLocation: (lng: number, lat: number) => void;
  placeUserLocation: (lng: number, lat: number) => void;
  reload: () => void;
};

type MapboxMapProps = {
  events: SpritzEvent[];
  onReady?: () => void;
  onLocated?: () => void;
  onUserPanned?: () => void;
  onError?: () => void;
};

// Native mounts Mapbox GL JS inside a WebView (see MapboxMap.tsx) because
// there's no first-party Mapbox SDK wired up — react-native-webview has no
// web implementation at all, though, so this is a from-scratch port that
// mounts the same GL JS library directly into a real DOM node instead.
export const MapboxMap = forwardRef<MapboxMapHandle, MapboxMapProps>(function MapboxMap(
  { events, onReady, onLocated, onUserPanned, onError },
  ref
) {
  const { scheme } = useAppTheme();
  const styleUrl = scheme === 'dark' ? MAPBOX_STYLE_URL_DARK : MAPBOX_STYLE_URL_LIGHT;
  // Once Mapbox has proven dead this page load (see markMapboxDead), skip
  // straight to the spare map on every later mount instead of re-probing a
  // service that just failed and making the user sit through another
  // MAP_LOAD_TIMEOUT_MS.
  const [provider, setProvider] = useState<Provider>(() => (isMapboxKnownDead() ? 'maplibre' : 'mapbox'));
  // OpenFreeMap has no dark variant of its own (see OPENFREEMAP_STYLE_URL) —
  // this collapses to a constant once in fallback mode, which matters for
  // the effect below: it's what keeps a light/dark theme toggle from
  // rebuilding (and re-flashing) the fallback map for no visual gain.
  const effectiveStyleUrl = provider === 'mapbox' ? styleUrl : OPENFREEMAP_STYLE_URL;
  // View's ref forwards to the underlying <div> under react-native-web —
  // that's the real DOM node mapboxgl.Map needs as its container.
  const containerRef = useRef<View>(null);
  const mapRef = useRef<any>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const userMarkerRef = useRef<any>(null);
  const eventMarkersRef = useRef<Map<string, any>>(new Map());
  const knownEventCountRef = useRef(0);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  // Bumped by the explicit reload() below, same idiom as the native version —
  // the only other thing that tears down and rebuilds the map is a theme swap.
  const [reloadNonce, setReloadNonce] = useState(0);
  // Mapbox GL JS paints a blank canvas the instant it's constructed, well
  // before the style/tiles have actually loaded — without gating visibility
  // on this, that blank canvas flashes on top of FakeMapBackdrop before the
  // real map appears. Stays false forever on error, so the backdrop remains
  // as the permanent fallback.
  const [ready, setReady] = useState(false);

  function addEventPin(map: any, ev: PinData) {
    // Whichever library actually loaded — see the build effect below, only
    // one of these two globals will exist at a time.
    const gl = (window as any).mapboxgl || (window as any).maplibregl;
    const el = document.createElement('div');
    el.className = 'spritz-event-pin';
    el.style.background = ev.color;
    el.innerHTML = `<span>${ev.emoji}</span>`;
    el.addEventListener('click', () => {
      const p = map.project([ev.lng, ev.lat]);
      router.push({
        pathname: '/event/[id]',
        params: { id: ev.id, originX: String(Math.round(p.x)), originY: String(Math.round(p.y)) },
      });
    });
    const marker = new gl.Marker({ element: el, anchor: 'bottom' }).setLngLat([ev.lng, ev.lat]).addTo(map);
    eventMarkersRef.current.set(ev.id, marker);
  }

  function addEasterEggPin(map: any, egg: (typeof EASTER_EGG_PINS)[number]) {
    const gl = (window as any).mapboxgl || (window as any).maplibregl;
    const el = document.createElement('div');
    el.className = 'spritz-event-pin';
    el.style.background = egg.color;
    el.innerHTML = `<span>${egg.emoji}</span>`;
    el.addEventListener('click', () => {
      showAlert(egg.title, formatEasterEggDate(egg.happensAt));
    });
    new gl.Marker({ element: el, anchor: 'bottom' }).setLngLat([egg.lng, egg.lat]).addTo(map);
  }

  function ensureUserMarker(map: any, lng: number, lat: number) {
    const gl = (window as any).mapboxgl || (window as any).maplibregl;
    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'spritz-user-pin';
      userMarkerRef.current = new gl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
    } else {
      userMarkerRef.current.setLngLat([lng, lat]);
    }
  }

  // (Re)builds the map whenever the style changes or an explicit reload asks
  // for it — mirrors the native version's html useMemo keyed on the same
  // deps. Deliberately keyed on `effectiveStyleUrl`, not `styleUrl` — see its
  // definition above for why that matters once `provider` is 'maplibre'.
  useEffect(() => {
    let cancelled = false;
    // One-shot per build attempt: Mapbox's 'error' event fires once per
    // failed tile request, so without this a single broken load could try
    // to fall back (or report terminal failure) many times over.
    let settled = false;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    setReady(false);

    for (const marker of eventMarkersRef.current.values()) marker.remove();
    eventMarkersRef.current.clear();
    userMarkerRef.current = null;

    // Reached only for a failure severe enough to matter: the library
    // itself won't load, the map never fires 'load' within the timeout, or
    // it errors before ever reaching 'ready'. On the primary provider that
    // means falling back to the spare map; on the spare map itself (nothing
    // left to fall back to) it's terminal — same as the old unconditional
    // onError() this replaces.
    function handleFailure(reason: string) {
      if (cancelled || settled) return;
      settled = true;
      if (provider === 'mapbox') {
        if (__DEV__) console.log('[MapboxMap] Mapbox failed (' + reason + '), falling back to MapLibre/OpenFreeMap');
        markMapboxDead();
        setProvider('maplibre');
      } else {
        if (__DEV__) console.log('[MapboxMap] MapLibre fallback also failed (' + reason + ')');
        onError?.();
      }
    }

    const load = provider === 'mapbox' ? loadMapboxGl : loadMapLibreGl;

    load()
      .then((gl) => {
        if (cancelled) return;
        const node = containerRef.current as unknown as HTMLElement | null;
        if (!node) return;

        // OpenFreeMap needs no token — that's the point of it as a spare.
        if (provider === 'mapbox') gl.accessToken = MAPBOX_ACCESS_TOKEN;

        const map = new gl.Map({
          container: node,
          style: effectiveStyleUrl,
          center: MAPBOX_INITIAL_VIEW.center,
          zoom: MAPBOX_INITIAL_VIEW.zoom,
          bearing: MAPBOX_INITIAL_VIEW.bearing,
          pitch: MAPBOX_INITIAL_VIEW.pitch,
        });
        mapRef.current = map;

        // The container isn't necessarily at its final layout size yet when
        // the map is constructed (react-native-web's flex layout settles
        // asynchronously) — mapboxgl captures whatever size it measures at
        // construction time and never re-measures on its own, so without
        // this the canvas can get stuck rendering into a stale, too-small
        // buffer forever while the surrounding layout looks fine.
        const resizeObserver = new ResizeObserver(() => map.resize());
        resizeObserver.observe(node);
        resizeObserverRef.current = resizeObserver;

        let loaded = false;
        // Covers "server accepts the connection and just hangs" and "loads
        // a broken/empty style" — neither fires 'load' or 'error' on its own.
        timeoutTimer = setTimeout(() => {
          if (!loaded) handleFailure('load timeout');
        }, MAP_LOAD_TIMEOUT_MS);

        map.on('load', () => {
          if (cancelled) return;
          loaded = true;
          clearTimeout(timeoutTimer);
          knownEventCountRef.current = eventsRef.current.length;
          for (const pin of toPinData(eventsRef.current)) addEventPin(map, pin);
          for (const egg of EASTER_EGG_PINS) addEasterEggPin(map, egg);
          setReady(true);
          onReady?.();
        });
        map.on('dragstart', () => onUserPanned?.());
        map.on('error', (e: any) => {
          if (cancelled) return;
          if (!loaded) {
            handleFailure(e?.error?.message || 'map error before load');
          } else if (__DEV__) {
            // A tile 404 or transient network blip after the map is already
            // up isn't worth tearing down a working map over.
            console.log('[MapboxMap] post-load error (ignored):', e?.error);
          }
        });
      })
      .catch((err) => {
        handleFailure(err?.message || 'failed to load map library');
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutTimer);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveStyleUrl, reloadNonce, provider]);

  // A new event appended after the map already loaded gets its pin injected
  // directly instead of waiting for (or forcing) a reload — same as native.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || events.length <= knownEventCountRef.current) {
      knownEventCountRef.current = events.length;
      return;
    }
    const newOnes = events.slice(knownEventCountRef.current);
    for (const pin of toPinData(newOnes)) addEventPin(map, pin);
    knownEventCountRef.current = events.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  useImperativeHandle(ref, () => ({
    flyToLocation(lng: number, lat: number) {
      const map = mapRef.current;
      if (!map) return;
      ensureUserMarker(map, lng, lat);
      map.flyTo({ center: [lng, lat], zoom: 16, pitch: 40, bearing: 0, speed: 0.85, curve: 1.3, essential: true });
      map.once('moveend', () => onLocated?.());
    },
    placeUserLocation(lng: number, lat: number) {
      const map = mapRef.current;
      if (!map) return;
      ensureUserMarker(map, lng, lat);
    },
    reload() {
      setReloadNonce((n) => n + 1);
    },
  }));

  return (
    <>
      {/* Sits underneath the real map at all times — same as native, shows
          through until tiles paint over it and stays as the error fallback. */}
      <FakeMapBackdrop />
      <View ref={containerRef} style={[styles.webview, !ready && styles.hidden]} />
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
    // Belt-and-suspenders alongside top/left/right/bottom: percentage sizing
    // doesn't depend on the parent being resolved as a positioned containing
    // block, so this still fills correctly even if that ever regresses again.
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  hidden: {
    opacity: 0,
  },
});
