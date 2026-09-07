import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { isRunningInExpoGo } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'departure-reminder:';

// Same gate as lib/pushTokens.ts's pushUnsupportedHere — merely importing
// expo-notifications throws under Expo Go on Android, so every entry point
// here has to check this before ever touching the module.
function notificationsUnsupportedHere(): boolean {
  return Platform.OS === 'web' || !Device.isDevice || (Platform.OS === 'android' && isRunningInExpoGo());
}

// A purely local, on-device reminder — no server round-trip, no push token.
// The scheduled notification's id is kept in AsyncStorage (keyed by event)
// so a later toggle-off can find and cancel exactly this one.
export async function getScheduledDepartureReminder(eventId: string): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_PREFIX + eventId);
}

export async function scheduleDepartureReminder(eventId: string, eventTitle: string, leaveAt: Date): Promise<boolean> {
  if (notificationsUnsupportedHere()) return false;
  if (leaveAt.getTime() <= Date.now()) return false;

  const Notifications = await import('expo-notifications');
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return false;

  await cancelDepartureReminder(eventId);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'E timpul să pleci! 🚗',
      body: `Ca să ajungi la timp la „${eventTitle}", ar trebui să pleci acum.`,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: leaveAt },
  });
  await AsyncStorage.setItem(STORAGE_PREFIX + eventId, id);
  return true;
}

export async function cancelDepartureReminder(eventId: string): Promise<void> {
  const existing = await AsyncStorage.getItem(STORAGE_PREFIX + eventId);
  if (!existing) return;
  if (!notificationsUnsupportedHere()) {
    try {
      const Notifications = await import('expo-notifications');
      await Notifications.cancelScheduledNotificationAsync(existing);
    } catch {
      // Best-effort — worst case a stale scheduled notification still fires once.
    }
  }
  await AsyncStorage.removeItem(STORAGE_PREFIX + eventId);
}
