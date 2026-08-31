import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack, Redirect, useSegments } from 'expo-router';
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
import { HapticsProvider } from '@/contexts/HapticsContext';
import { EventsProvider } from '@/contexts/EventsContext';
import { DevFlagsProvider } from '@/contexts/DevFlagsContext';
import { UserProvider, useUser } from '@/contexts/UserContext';
import { AnimatedSplash } from '@/components/common/AnimatedSplash';

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
    >
      <Stack.Screen name="verification" options={{ animation: 'slide_from_right' }} />
      {/* The screen itself animates in (growing from the tapped map pin —
          see app/event/[id].tsx), so the native-stack transition is turned
          off here to avoid the two fighting/compounding. */}
      <Stack.Screen name="event/[id]" options={{ animation: 'none' }} />
    </Stack>
  );
}

// Redirects unauthenticated users to /auth, and authenticated ones away from
// it. Only mounts once the branded splash finishes (see RootLayout below),
// by which point UserProvider's one AsyncStorage read has long since
// resolved, so `loading` is already false and there's no flash of the map
// before the redirect fires.
function AuthGate() {
  const segments = useSegments();
  const { loading, authenticated } = useUser();
  const firstSegment = segments[0];

  if (loading) {
    return null;
  }

  if (!authenticated) {
    if (firstSegment !== 'auth' && firstSegment !== 'verification') {
      return <Redirect href="/auth" />;
    }
    return null;
  }

  if (firstSegment === 'auth') {
    return <Redirect href="/" />;
  }

  return null;
}

// The floating tab bar belongs to the authenticated app shell, not the
// auth/verification flow — it would otherwise float over the login form.
function AppChrome() {
  const segments = useSegments();
  const firstSegment = segments[0];
  const showNav = firstSegment !== 'auth' && firstSegment !== 'verification';

  return (
    <>
      <AuthGate />
      <RootStack />
      {showNav && <FloatingBottomNav />}
    </>
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
  // Once true, swaps the branded AnimatedSplash out for the real app — see
  // the render below for why this needs the fonts already loaded.
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (loaded || error) {
      // Safe to reveal our own JS tree now — it renders AnimatedSplash first
      // (same solid green as the native splash, so there's no flash), which
      // needs the fonts to already be loaded to draw the wordmark correctly.
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <UserProvider>
          <HapticsProvider>
            <DevFlagsProvider>
              <EventsProvider>
                <NavVisibilityProvider>
                  {!splashDone ? (
                    <AnimatedSplash onFinish={() => setSplashDone(true)} />
                  ) : (
                    <View style={{ flex: 1 }}>
                      <AppChrome />
                    </View>
                  )}
                </NavVisibilityProvider>
              </EventsProvider>
            </DevFlagsProvider>
          </HapticsProvider>
        </UserProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
