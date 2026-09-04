import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import {
  MAPBOX_ACCESS_TOKEN,
  MAPBOX_GL_JS_VERSION,
  MAPBOX_INITIAL_VIEW,
  MAPBOX_STYLE_URL_DARK,
  MAPBOX_STYLE_URL_LIGHT,
} from '@/constants/mapbox';
import { colors, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { alertPermissionDenied } from '@/lib/permissions';

type Coords = { lng: number; lat: number };

function buildPickerHtml(styleUrl: string, center: Coords) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no" />
  <link href="https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_JS_VERSION}/mapbox-gl.css" rel="stylesheet" />
  <style>html, body, #map { position: absolute; inset: 0; margin: 0; padding: 0; }</style>
</head>
<body>
  <div id="map"></div>
  <script src="https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_JS_VERSION}/mapbox-gl.js"></script>
  <script>
    function send(message) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(message); }
    try {
      mapboxgl.accessToken = '${MAPBOX_ACCESS_TOKEN}';
      var map = new mapboxgl.Map({
        container: 'map',
        style: '${styleUrl}',
        center: [${center.lng}, ${center.lat}],
        zoom: 15,
      });
      function sendCenter() {
        var c = map.getCenter();
        send('center:' + c.lng + ':' + c.lat);
      }
      map.on('load', function () { send('loaded'); sendCenter(); });
      map.on('moveend', sendCenter);
      map.on('error', function (e) {
        send('error:' + ((e && e.error && e.error.message) || 'unknown'));
      });
      window.__flyTo = function (lng, lat) {
        map.flyTo({ center: [lng, lat], zoom: 16, essential: true });
      };
    } catch (e) {
      send('error:' + (e && e.message ? e.message : String(e)));
    }
  </script>
</body>
</html>`;
}

// A "drop a pin anywhere" picker: the pin stays fixed at screen center while
// the map pans underneath it (same idiom as Google/Apple Maps location
// pickers), plus an address search that flies the map there instead of
// requiring the user to hunt for it manually. Replaces new-event.tsx's old
// behavior of silently using the host's current GPS fix as the only option.
export function LocationPickerModal({
  visible,
  initialCoords,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  initialCoords: Coords | null;
  onConfirm: (coords: Coords) => void;
  onClose: () => void;
}) {
  const { scheme, colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const styleUrl = scheme === 'dark' ? MAPBOX_STYLE_URL_DARK : MAPBOX_STYLE_URL_LIGHT;
  const startCenter = initialCoords ?? { lng: MAPBOX_INITIAL_VIEW.center[0], lat: MAPBOX_INITIAL_VIEW.center[1] };

  // Only ever read at mount (embedded directly in the HTML string) — the map
  // then owns its own camera; we track where it ends up via 'center:' messages.
  const html = useMemo(() => buildPickerHtml(styleUrl, startCenter), [styleUrl, visible]);
  const webviewRef = useRef<WebView>(null);

  const [center, setCenter] = useState<Coords>(startCenter);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searchNotFound, setSearchNotFound] = useState(false);

  function handleMessage(event: WebViewMessageEvent) {
    const data = event.nativeEvent.data;
    if (data === 'loaded') {
      setReady(true);
    } else if (data.startsWith('center:')) {
      const [, lng, lat] = data.split(':');
      setCenter({ lng: Number(lng), lat: Number(lat) });
    }
  }

  async function handleSearch() {
    const trimmed = query.trim();
    if (!trimmed || searching) return;
    setSearching(true);
    setSearchNotFound(false);
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&proximity=${center.lng},${center.lat}&limit=1&language=ro`;
      const response = await fetch(url);
      const json = await response.json();
      const feature = json.features?.[0];
      if (feature?.center) {
        const [lng, lat] = feature.center;
        webviewRef.current?.injectJavaScript(`window.__flyTo && window.__flyTo(${lng}, ${lat}); true;`);
      } else {
        // Previously silent — a mistyped search just looked like the button
        // did nothing, with no way to tell "no results" from "didn't tap it".
        setSearchNotFound(true);
      }
    } catch {
      setSearchNotFound(true);
    } finally {
      setSearching(false);
    }
  }

  async function handleUseMyLocation() {
    setLocating(true);
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const position = await Location.getCurrentPositionAsync({});
        const { longitude, latitude } = position.coords;
        webviewRef.current?.injectJavaScript(`window.__flyTo && window.__flyTo(${longitude}, ${latitude}); true;`);
      } else {
        alertPermissionDenied(canAskAgain, 'Activează locația din Setările telefonului ca să pornești harta de la poziția ta.');
      }
    } catch {
      // Ignore — user can still search or drag the map.
    } finally {
      setLocating(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
        <View style={[styles.topBar, { borderColor: theme.border }]}>
          <Pressable onPress={onClose} hitSlop={10} style={[styles.iconButton, { backgroundColor: theme.surfaceMuted }]}>
            <Ionicons name="close" size={20} color={theme.textPrimary} />
          </Pressable>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Alege locația</Text>
          <View style={styles.iconButton} />
        </View>

        <View style={styles.searchRow}>
          <View style={[styles.searchInputWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="search" size={16} color={theme.textSecondary} />
            <TextInput
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                setSearchNotFound(false);
              }}
              onSubmitEditing={handleSearch}
              placeholder="Caută o adresă sau un loc"
              placeholderTextColor={theme.textSecondary}
              style={[styles.searchInput, { color: theme.textPrimary }]}
              returnKeyType="search"
            />
          </View>
          <Pressable
            onPress={handleUseMyLocation}
            disabled={locating}
            style={[styles.locateButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            {locating ? <ActivityIndicator size="small" color={colors.green500} /> : <Ionicons name="locate" size={18} color={colors.green500} />}
          </Pressable>
        </View>

        {searchNotFound && (
          <Text style={[styles.searchHint, { color: theme.textSecondary }]}>Nicio locație găsită.</Text>
        )}

        <View style={styles.mapArea}>
          <WebView
            ref={webviewRef}
            source={{ html, baseUrl: 'https://localhost' }}
            style={styles.webview}
            onMessage={handleMessage}
          />
          {!ready && (
            <View style={[styles.mapLoading, { backgroundColor: theme.page }]}>
              <ActivityIndicator color={colors.green500} />
            </View>
          )}
          <View pointerEvents="none" style={styles.pinWrap}>
            <Ionicons name="location" size={40} color={colors.green500} />
          </View>
        </View>

        <View style={[styles.bottomBar, { paddingBottom: 20 }]}>
          <Pressable
            onPress={() => {
              light();
              onConfirm(center);
            }}
            style={[styles.confirmButton, shadows.glowGreen]}
          >
            <Text style={styles.confirmText}>Confirmă locația</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800' },
  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: spacing.lg, paddingTop: 12, paddingBottom: 4 },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 12,
    height: 46,
  },
  searchInput: { flex: 1, fontSize: 14 },
  searchHint: { fontSize: 12, fontStyle: 'italic', paddingHorizontal: spacing.lg, paddingTop: 4 },
  locateButton: { width: 46, height: 46, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  mapArea: { flex: 1, marginTop: 8, position: 'relative' },
  webview: { flex: 1 },
  mapLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  pinWrap: { position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -40 },
  bottomBar: { paddingHorizontal: spacing.lg, paddingTop: 14 },
  confirmButton: { height: 56, borderRadius: 28, backgroundColor: colors.green500, alignItems: 'center', justifyContent: 'center' },
  confirmText: { color: colors.white, fontSize: 16, fontWeight: '900' },
});
