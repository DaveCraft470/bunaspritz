import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Location from 'expo-location';

import { colors, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useEvents } from '@/contexts/EventsContext';
import { FadeInUp } from '@/components/common/FadeInUp';
import { MapboxMap, type MapboxMapHandle } from './MapboxMap';
import { LogoWordmark } from './LogoWordmark';
import { EventsCaption } from './EventsCaption';
import { FloatingCircleButton } from './FloatingCircleButton';
import { MenuButton } from './MenuButton';

export function MapPlaceholder() {
  const insets = useSafeAreaInsets();
  const { scheme, colors: theme } = useAppTheme();
  const fade = useRef(new Animated.Value(1)).current;
  const mapRef = useRef<MapboxMapHandle>(null);
  const isLocatingRef = useRef(false);
  // Tracks where we last flew to and whether the user has since dragged the
  // map away from it, so mashing the locate button while already centered on
  // your spot doesn't keep re-running the flyTo animation for nothing.
  const lastFlownRef = useRef<{ lng: number; lat: number } | null>(null);
  const hasPannedAwayRef = useRef(false);
  const { medium, light } = useHaptics();
  const { events, refresh } = useEvents();
  const [reloading, setReloading] = useState(false);

  const ALREADY_THERE_DEGREES = 0.0005; // ~55m — comfortably inside GPS jitter

  function isAlreadyThere(lng: number, lat: number) {
    if (!lastFlownRef.current || hasPannedAwayRef.current) return false;
    const dLng = lng - lastFlownRef.current.lng;
    const dLat = lat - lastFlownRef.current.lat;
    return Math.sqrt(dLng * dLng + dLat * dLat) < ALREADY_THERE_DEGREES;
  }

  useEffect(() => {
    fade.setValue(0.35);
    Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [scheme, fade]);

  // Called once the map has finished loading — places the "you are here" dot
  // right away (no camera movement) so it's already there before the user
  // ever touches the locate button, instead of only appearing on first press.
  async function handleMapReady() {
    setReloading(false);
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const last = await Location.getLastKnownPositionAsync();
      if (last) mapRef.current?.placeUserLocation(last.coords.longitude, last.coords.latitude);
    } catch {
      // Passive/background attempt — fail silently, the button still works.
    }
  }

  async function handleLocatePress() {
    // Ignore spam taps instead of racing multiple location lookups.
    if (isLocatingRef.current) return;
    isLocatingRef.current = true;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permisiune necesară', 'Activează locația ca să te putem găsi pe hartă.');
        return;
      }
      // getLastKnownPositionAsync returns a cached fix instantly; only fall
      // back to the slow, active getCurrentPositionAsync if nothing's cached
      // yet — that's what was causing the multi-second lag on every press.
      let coords = (await Location.getLastKnownPositionAsync())?.coords;
      if (!coords) {
        coords = (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })).coords;
      }
      if (isAlreadyThere(coords.longitude, coords.latitude)) return;
      mapRef.current?.flyToLocation(coords.longitude, coords.latitude);
      lastFlownRef.current = { lng: coords.longitude, lat: coords.latitude };
      hasPannedAwayRef.current = false;
    } catch {
      Alert.alert('Nu te găsim', 'Nu am putut lua locația ta. Încearcă din nou.');
    } finally {
      isLocatingRef.current = false;
    }
  }

  // "Classic" pull-to-reload, scoped to the header/logo cluster instead of
  // the whole screen — the map itself needs every drag for panning, so a
  // full-screen pull gesture here would fight it. Wraps only this small area.
  const PULL_THRESHOLD = 56;
  const pullY = useSharedValue(0);
  const crossedThreshold = useSharedValue(false);

  async function triggerReload() {
    if (reloading) return;
    medium();
    setReloading(true);
    // Fetch the latest events BEFORE reloading — MapboxMap's reload rebuilds
    // its HTML from whatever `events` this component currently holds, so
    // reloading first would bake in a stale list and silently drop any pin
    // added since mount. `reloading` itself is cleared by onReady/onError
    // below, once the map actually finishes, not when this fetch resolves.
    await refresh();
    mapRef.current?.reload();
  }

  const pullGesture = Gesture.Pan()
    .enabled(!reloading)
    .activeOffsetY(12)
    .failOffsetX([-15, 15])
    .onUpdate((e) => {
      if (e.translationY <= 0) {
        pullY.value = 0;
        crossedThreshold.value = false;
        return;
      }
      // Resistance past the halfway point so it doesn't feel like it just
      // keeps dragging forever — settles in on approach to the threshold.
      pullY.value = Math.min(e.translationY * 0.5, PULL_THRESHOLD * 1.3);

      // One haptic tick the moment it crosses "will reload if released now",
      // same idea as the native pull-to-refresh feel — not one per frame.
      const nowPast = pullY.value >= PULL_THRESHOLD;
      if (nowPast !== crossedThreshold.value) {
        crossedThreshold.value = nowPast;
        runOnJS(light)();
      }
    })
    .onEnd(() => {
      if (pullY.value >= PULL_THRESHOLD) {
        runOnJS(triggerReload)();
      }
      pullY.value = withSpring(0);
      crossedThreshold.value = false;
    });

  const pullStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pullY.value }],
  }));

  return (
    <Animated.View style={[styles.container, { backgroundColor: theme.mapBase, opacity: fade }]}>
      <MapboxMap
        ref={mapRef}
        events={events}
        onReady={handleMapReady}
        onLocated={medium}
        onUserPanned={() => {
          hasPannedAwayRef.current = true;
        }}
        onError={() => setReloading(false)}
      />

      <FadeInUp style={[styles.headerCluster, { top: insets.top + spacing.md }]}>
        {/* GestureDetector needs a ref-forwarding native view as its direct
            child — FadeInUp is a plain function component and doesn't
            forward one, so the gesture wraps this inner Reanimated.View
            instead, with FadeInUp only handling the entrance animation. */}
        <GestureDetector gesture={pullGesture}>
          <Reanimated.View style={[styles.pullTarget, pullStyle]}>
            <LogoWordmark />
            <View style={{ height: spacing.sm }} />
            <EventsCaption>12 evenimente azi</EventsCaption>
            {reloading && (
              <ActivityIndicator size="small" color={colors.green500} style={styles.reloadSpinner} />
            )}
          </Reanimated.View>
        </GestureDetector>
      </FadeInUp>

      <FadeInUp delay={80} style={[styles.themeToggle, { top: insets.top + spacing.md + 44 }]}>
        <MenuButton />
      </FadeInUp>

      <FadeInUp delay={140} style={[styles.bottomLeft, { bottom: insets.bottom + 96 }]}>
        <FloatingCircleButton
          icon="search-outline"
          onPress={() => router.push('/search')}
          accessibilityLabel="Caută prieteni"
        />
      </FadeInUp>
      <FadeInUp delay={200} style={[styles.bottomRight, { bottom: insets.bottom + 96 }]}>
        <FloatingCircleButton icon="navigate-outline" onPress={handleLocatePress} accessibilityLabel="Mergi la locația mea" />
      </FadeInUp>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  headerCluster: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
  },
  pullTarget: {
    alignItems: 'center',
  },
  reloadSpinner: {
    marginTop: spacing.sm,
  },
  themeToggle: {
    position: 'absolute',
    right: spacing.lg,
  },
  bottomLeft: {
    position: 'absolute',
    left: spacing.lg,
  },
  bottomRight: {
    position: 'absolute',
    right: spacing.lg,
  },
});
