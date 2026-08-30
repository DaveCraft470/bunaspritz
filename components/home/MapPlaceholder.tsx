import { useEffect, useRef } from 'react';
import { Alert, Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import { spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
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

  useEffect(() => {
    fade.setValue(0.35);
    Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [scheme, fade]);

  // Called once the map has finished loading — places the "you are here" dot
  // right away (no camera movement) so it's already there before the user
  // ever touches the locate button, instead of only appearing on first press.
  async function handleMapReady() {
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
      mapRef.current?.flyToLocation(coords.longitude, coords.latitude);
    } catch {
      Alert.alert('Nu te găsim', 'Nu am putut lua locația ta. Încearcă din nou.');
    } finally {
      isLocatingRef.current = false;
    }
  }

  return (
    <Animated.View style={[styles.container, { backgroundColor: theme.mapBase, opacity: fade }]}>
      <MapboxMap ref={mapRef} onReady={handleMapReady} />

      <FadeInUp style={[styles.headerCluster, { top: insets.top + spacing.md }]}>
        <LogoWordmark />
        <View style={{ height: spacing.sm }} />
        <EventsCaption>12 evenimente azi</EventsCaption>
      </FadeInUp>

      <FadeInUp delay={80} style={[styles.themeToggle, { top: insets.top + spacing.md + 44 }]}>
        <MenuButton />
      </FadeInUp>

      <FadeInUp delay={140} style={[styles.bottomLeft, { bottom: insets.bottom + 96 }]}>
        <FloatingCircleButton icon="search-outline" />
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
