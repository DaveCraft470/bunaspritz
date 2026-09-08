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

// Same web gap as showAlert, but for confirm/cancel dialogs: any Alert.alert
// call with a buttons array (and therefore an onPress callback the caller
// depends on to actually do something) is a silent no-op on web — the
// confirm text: label used here for the affirmative choice was always
// getting lost with it. window.confirm() only gives a single OK/Cancel
// pair (no custom labels, no destructive styling), which is the ceiling of
// what the web platform offers here.
export function showConfirm(
  title: string,
  message: string,
  confirmText: string,
  cancelText: string,
  onConfirm: () => void,
) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelText, style: 'cancel' },
    { text: confirmText, style: 'destructive', onPress: onConfirm },
  ]);
}
