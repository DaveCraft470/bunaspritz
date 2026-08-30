import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import {
  MAPBOX_ACCESS_TOKEN,
  MAPBOX_GL_JS_VERSION,
  MAPBOX_INITIAL_VIEW,
  MAPBOX_STYLE_URL_DARK,
  MAPBOX_STYLE_URL_LIGHT,
} from '@/constants/mapbox';
import { useAppTheme } from '@/contexts/ThemeContext';
import { FakeMapBackdrop } from './FakeMapBackdrop';

const LOAD_TIMEOUT_MS = 10000;

// Placeholder events scattered around Brașov, just so the map isn't empty —
// swap for real event data once that exists.
const FAKE_EVENTS = [
  { title: 'Seară de jazz', detail: 'Curtea Muzeului · 20:00', emoji: '🎷', color: '#FF9F5A', lng: 25.6203, lat: 45.646 },
  { title: 'Picnic în parc', detail: 'Parcul Central · 17:30', emoji: '🧺', color: '#5FD98A', lng: 25.6122, lat: 45.6501 },
  { title: 'Drumeție pe Tâmpa', detail: 'Telecabină · 09:00', emoji: '🥾', color: '#5AA9E6', lng: 25.5975, lat: 45.638 },
  { title: 'Seară la Poiana', detail: 'Poiana Brașov · 19:00', emoji: '🍻', color: '#FFD25A', lng: 25.556, lat: 45.594 },
  { title: 'Street food night', detail: 'Piața Sfatului · 18:00', emoji: '🌮', color: '#FF6B81', lng: 25.591, lat: 45.6427 },
  { title: 'Concert acustic', detail: 'Grădina de vară · 21:00', emoji: '🎸', color: '#B388FF', lng: 25.628, lat: 45.6505 },
  { title: 'Board games meetup', detail: 'Cafenea centrală · 18:30', emoji: '🎲', color: '#4ED9C9', lng: 25.6055, lat: 45.652 },
];

function buildHtml(styleUrl: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no" />
  <link href="https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_JS_VERSION}/mapbox-gl.css" rel="stylesheet" />
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
    .mapboxgl-popup-content {
      border-radius: 14px;
      padding: 10px 14px;
      font-family: -apple-system, Roboto, sans-serif;
      box-shadow: 0 8px 24px rgba(0,0,0,0.28);
    }
    .mapboxgl-popup-content strong {
      display: block;
      font-size: 13px;
      margin-bottom: 2px;
    }
    .mapboxgl-popup-content span {
      font-size: 11px;
      color: #6D6D6D;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_JS_VERSION}/mapbox-gl.js"></script>
  <script>
    function send(message) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(message);
    }
    window.onerror = function (msg) { send('debug:window.onerror ' + msg); };
    document.addEventListener('webglcontextcreationerror', function (e) {
      send('error:webglcontextcreationerror ' + (e.statusMessage || 'unknown'));
    }, false);
    send('debug:script running, mapboxgl=' + (typeof mapboxgl) + ', webgl2=' + !!document.createElement('canvas').getContext('webgl2'));
    (function () {
      var ctrl = new AbortController();
      var timer = setTimeout(function () { ctrl.abort(); }, 5000);
      fetch('https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${MAPBOX_ACCESS_TOKEN}', { signal: ctrl.signal })
        .then(function (r) { clearTimeout(timer); send('debug:network probe status ' + r.status); })
        .catch(function (err) { clearTimeout(timer); send('debug:network probe failed ' + (err && err.message ? err.message : String(err))); });
    })();
    try {
      mapboxgl.accessToken = '${MAPBOX_ACCESS_TOKEN}';
      var map = new mapboxgl.Map({
        container: 'map',
        style: '${styleUrl}',
        center: [${MAPBOX_INITIAL_VIEW.center[0]}, ${MAPBOX_INITIAL_VIEW.center[1]}],
        zoom: ${MAPBOX_INITIAL_VIEW.zoom},
        bearing: ${MAPBOX_INITIAL_VIEW.bearing},
        pitch: ${MAPBOX_INITIAL_VIEW.pitch},
      });
      send('debug:map constructed');
      map.on('load', function () {
        send('loaded');
        var events = ${JSON.stringify(FAKE_EVENTS)};
        events.forEach(function (ev) {
          var el = document.createElement('div');
          el.className = 'event-pin';
          el.style.background = ev.color;
          el.innerHTML = '<span>' + ev.emoji + '</span>';
          var popup = new mapboxgl.Popup({ offset: 22, closeButton: false })
            .setHTML('<strong>' + ev.title + '</strong><span>' + ev.detail + '</span>');
          new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([ev.lng, ev.lat])
            .setPopup(popup)
            .addTo(map);
        });
      });
      map.on('idle', function () { send('debug:idle'); });
      map.on('error', function (e) {
        var msg = (e && e.error && e.error.message) || JSON.stringify(e && e.error) || 'unknown';
        send('error:' + msg);
      });
    } catch (e) {
      send('error:' + (e && e.message ? e.message : String(e)));
    }
  </script>
</body>
</html>`;
}

type Status = 'loading' | 'ready' | 'error';

export function MapboxMap() {
  const { scheme } = useAppTheme();
  const styleUrl = scheme === 'dark' ? MAPBOX_STYLE_URL_DARK : MAPBOX_STYLE_URL_LIGHT;
  const html = useMemo(() => buildHtml(styleUrl), [styleUrl]);

  const [status, setStatus] = useState<Status>('loading');
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  // Switching themes swaps the style URL, which reloads the WebView — treat
  // that like a fresh load so the timeout/debug state track the reload
  // instead of holding onto the previous theme's status.
  useEffect(() => {
    setStatus('loading');
  }, [styleUrl]);

  useEffect(() => {
    if (status !== 'loading') return;
    const timer = setTimeout(() => setStatus('error'), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const handleMessage = (event: WebViewMessageEvent) => {
    const data = event.nativeEvent.data;
    console.log('[MapboxMap]', data);
    setLastMessage(data);
    if (data === 'loaded') setStatus('ready');
    else if (data.startsWith('error:')) setStatus('error');
  };

  return (
    <>
      {/* Sits underneath the real map at all times — the WebView's
          transparent background lets it show through until tiles paint
          over it, and it stays as the fallback if the real map errors out. */}
      <FakeMapBackdrop />
      <WebView
        source={{ html, baseUrl: 'https://localhost' }}
        style={styles.webview}
        androidLayerType="hardware"
        onMessage={handleMessage}
        onError={(e) => {
          setLastMessage('webview:onError ' + JSON.stringify(e.nativeEvent));
          setStatus('error');
        }}
        onHttpError={(e) => {
          setLastMessage('webview:onHttpError ' + JSON.stringify(e.nativeEvent));
          setStatus('error');
        }}
      />
      {__DEV__ && status !== 'ready' && lastMessage ? (
        <Text style={styles.debugText}>{lastMessage}</Text>
      ) : null}
    </>
  );
}

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
