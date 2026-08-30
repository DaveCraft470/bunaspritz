import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Baloo2_400Regular,
  Baloo2_500Medium,
  Baloo2_600SemiBold,
  Baloo2_700Bold,
  Baloo2_800ExtraBold,
} from '@expo-google-fonts/baloo-2';
import { FredokaOne_400Regular } from '@expo-google-fonts/fredoka-one';

import { FloatingBottomNav } from '@/components/layout/FloatingBottomNav';
import { ThemeProvider, useAppTheme } from '@/contexts/ThemeContext';
import { NavVisibilityProvider } from '@/contexts/NavVisibilityContext';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootStack() {
  const { colors: theme } = useAppTheme();

  // contentStyle needs to roughly match the current scheme, not a fixed
  // color — otherwise navigating away from whichever scheme it doesn't
  // match just trades a white flash for a black one.
  //
  // animation: 'none' — these three routes are sibling tabs, not a push/pop
  // hierarchy, and native-stack can hold off a second navigation until an
  // in-flight fade transition finishes, which reads as the nav lagging
  // behind taps. Instant switches match how a tab bar should feel anyway.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'none',
        contentStyle: { backgroundColor: theme.mapBase },
      }}
    />
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Baloo2_400Regular,
    Baloo2_500Medium,
    Baloo2_600SemiBold,
    Baloo2_700Bold,
    Baloo2_800ExtraBold,
    FredokaOne_400Regular,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <NavVisibilityProvider>
          <View style={{ flex: 1 }}>
            <RootStack />
            <FloatingBottomNav />
          </View>
        </NavVisibilityProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
