import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

import { supabase } from '@/lib/supabase';

// Web push needs its own VAPID setup and isn't part of this pass — native
// only for now, which also matches expo-notifications' actual capabilities.
export async function registerForPushNotifications(userId: string): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;

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
