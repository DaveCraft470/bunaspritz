import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';

import { supabase } from '@/lib/supabase';

// Merely importing expo-notifications throws on Android under Expo Go (SDK
// 53 removed remote push support there, and the module throws at import
// time as a hard stop rather than a runtime no-op) — so the import has to
// be dynamic and gated by this check, never a static top-level import,
// or just opening the app in Expo Go on Android crashes before anything
// renders. iOS Expo Go only console.warns on that same import, so it's
// left alone here.
function pushUnsupportedHere(): boolean {
  return Platform.OS === 'web' || !Device.isDevice || (Platform.OS === 'android' && isRunningInExpoGo());
}

// Web push needs its own VAPID setup and isn't part of this pass — native
// only for now, which also matches expo-notifications' actual capabilities.
export async function registerForPushNotifications(userId: string): Promise<void> {
  if (pushUnsupportedHere()) return;
  const Notifications = await import('expo-notifications');

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from('push_tokens').upsert({ user_id: userId, token }, { onConflict: 'user_id,token' });
  } catch {
    // No-op: push is best-effort, and getExpoPushTokenAsync throws in
    // environments without real push capability (e.g. some emulators).
  }
}

// Removes only *this device's* token row, not every token the user has —
// they may be signed in on other devices too. Called on sign-out so a
// second person logging into the same physical device afterward doesn't
// silently keep receiving the first person's notifications forever.
export async function unregisterPushToken(userId: string): Promise<void> {
  if (pushUnsupportedHere()) return;

  try {
    const Notifications = await import('expo-notifications');
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from('push_tokens').delete().eq('user_id', userId).eq('token', token);
  } catch {
    // Best-effort, same as registration — worst case is one stale row.
  }
}
