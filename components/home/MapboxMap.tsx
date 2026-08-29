import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
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

function buildHtml(styleUrl: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no" />
  <link href="https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_JS_VERSION}/mapbox-gl.css" rel="stylesheet" />
  <style>
    html, body, #map { position: absolute; inset: 0; margin: 0; padding: 0; }
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
    send('debug:script running, mapboxgl=' + (typeof mapboxgl));
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
      map.on('load', function () { send('loaded'); });
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
  const fallbackOpacity = useRef(new Animated.Value(1)).current;

  // Switching themes swaps the style URL, which reloads the WebView — treat
  // that like a fresh load so the fallback map covers the reload instead of
  // holding the previous theme's map frozen on screen.
  useEffect(() => {
    setStatus('loading');
  }, [styleUrl]);

  useEffect(() => {
    if (status !== 'loading') return;
    const timer = setTimeout(() => setStatus('error'), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    Animated.timing(fallbackOpacity, {
      toValue: status === 'ready' ? 0 : 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [status, fallbackOpacity]);

  const handleMessage = (event: WebViewMessageEvent) => {
    const data = event.nativeEvent.data;
    console.log('[MapboxMap]', data);
    if (data === 'loaded') setStatus('ready');
    else if (data.startsWith('error:')) setStatus('error');
  };

  return (
    <>
      <WebView
        source={{ html }}
        style={styles.webview}
        onMessage={handleMessage}
        onError={() => setStatus('error')}
        onHttpError={() => setStatus('error')}
      />
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: fallbackOpacity }]}
        pointerEvents={status === 'ready' ? 'none' : 'auto'}
      >
        <FakeMapBackdrop />
      </Animated.View>
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
});
