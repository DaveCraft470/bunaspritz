import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import {
  MAPBOX_ACCESS_TOKEN,
  MAPBOX_INITIAL_VIEW,
  MAPBOX_STYLE_URL_DARK,
  MAPBOX_STYLE_URL_LIGHT,
} from '@/constants/mapbox';
import type { SpritzEvent } from '@/constants/events';
import { useAppTheme } from '@/contexts/ThemeContext';
import { loadMapboxGl } from '@/lib/mapboxGlWeb';
import { FakeMapBackdrop } from './FakeMapBackdrop';

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
  // View's ref forwards to the underlying <div> under react-native-web —
  // that's the real DOM node mapboxgl.Map needs as its container.
  const containerRef = useRef<View>(null);
  const mapRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const eventMarkersRef = useRef<Map<string, any>>(new Map());
  const knownEventCountRef = useRef(0);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  // Bumped by the explicit reload() below, same idiom as the native version —
  // the only other thing that tears down and rebuilds the map is a theme swap.
  const [reloadNonce, setReloadNonce] = useState(0);

  function addEventPin(map: any, ev: PinData) {
    const mapboxgl = (window as any).mapboxgl;
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
    const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([ev.lng, ev.lat]).addTo(map);
    eventMarkersRef.current.set(ev.id, marker);
  }

  function ensureUserMarker(map: any, lng: number, lat: number) {
    const mapboxgl = (window as any).mapboxgl;
    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'spritz-user-pin';
      userMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
    } else {
      userMarkerRef.current.setLngLat([lng, lat]);
    }
  }

  // (Re)builds the map whenever the style changes or an explicit reload asks
  // for it — mirrors the native version's html useMemo keyed on the same deps.
  useEffect(() => {
    let cancelled = false;

    for (const marker of eventMarkersRef.current.values()) marker.remove();
    eventMarkersRef.current.clear();
    userMarkerRef.current = null;

    loadMapboxGl()
      .then((mapboxgl) => {
        if (cancelled) return;
        const node = containerRef.current as unknown as HTMLElement | null;
        if (!node) return;

        mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
        const map = new mapboxgl.Map({
          container: node,
          style: styleUrl,
          center: MAPBOX_INITIAL_VIEW.center,
          zoom: MAPBOX_INITIAL_VIEW.zoom,
          bearing: MAPBOX_INITIAL_VIEW.bearing,
          pitch: MAPBOX_INITIAL_VIEW.pitch,
        });
        mapRef.current = map;

        map.on('load', () => {
          if (cancelled) return;
          knownEventCountRef.current = eventsRef.current.length;
          for (const pin of toPinData(eventsRef.current)) addEventPin(map, pin);
          onReady?.();
        });
        map.on('dragstart', () => onUserPanned?.());
        map.on('error', () => onError?.());
      })
      .catch(() => {
        if (!cancelled) onError?.();
      });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl, reloadNonce]);

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
      <View ref={containerRef} style={styles.webview} />
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
});
