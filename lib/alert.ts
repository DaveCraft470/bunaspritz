import { Alert, Platform } from 'react-native';

// react-native-web's Alert.alert is a no-op stub (`static alert() {}` — does
// nothing at all), so every plain title+message Alert.alert(...) call in the
// app has been silently swallowed on web this whole time: no popup, no
// console output, nothing. window.alert() is the direct browser equivalent
// for the simple "just show me the message" case this app actually uses.
export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
