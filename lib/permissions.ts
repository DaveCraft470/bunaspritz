import { Alert, Linking } from 'react-native';

// Shared by every permission-gated picker (photos, rental proof, location,
// mic — see contexts using this) — a denied permission used to just fail
// silently everywhere except voice notes. Only prompts when canAskAgain is
// false: that's the "already denied, OS won't even show the dialog again"
// case that's indistinguishable from a broken button without this.
export function alertPermissionDenied(canAskAgain: boolean, message: string) {
  if (canAskAgain) return;
  Alert.alert('Permisiune necesară', message, [
    { text: 'Anulează', style: 'cancel' },
    { text: 'Deschide Setări', onPress: () => Linking.openSettings() },
  ]);
}
