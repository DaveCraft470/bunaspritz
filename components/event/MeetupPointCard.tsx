import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/constants/theme';
import { buildDirectionsUrl, buildExactStaticMapUrl } from '@/constants/mapbox';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { alertPermissionDenied } from '@/lib/permissions';
import { showAlert } from '@/lib/alert';
import { getMeetupPoint, setMeetupPoint, subscribeToMeetupPoint, type MeetupPoint } from '@/lib/meetupPoint';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';

// A single shared meeting pin for the event, settable/movable by any
// attendee ("whoever sets it last" — see the migration). Scoped to the
// attendee's current device location rather than a full map-pin-drop UI —
// good enough for "meet me right here" without building a picker.
export function MeetupPointCard({
  eventId,
  userId,
  scheme,
  canSet,
  senderName,
}: {
  eventId: string;
  userId: string;
  scheme: 'light' | 'dark';
  canSet: boolean;
  senderName: (userId: string) => string;
}) {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const [point, setPoint] = useState<MeetupPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMeetupPoint(eventId)
      .then(setPoint)
      .finally(() => setLoading(false));
    return subscribeToMeetupPoint(eventId, setPoint);
  }, [eventId]);

  async function handleSetHere() {
    if (!canSet || saving) return;
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      alertPermissionDenied(permission.canAskAgain, 'Activează locația ca să poți seta un punct de întâlnire.');
      return;
    }
    light();
    setSaving(true);
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const ok = await setMeetupPoint(eventId, userId, position.coords.latitude, position.coords.longitude, '');
    setSaving(false);
    if (!ok) showAlert('A apărut o eroare', 'Nu am putut seta punctul de întâlnire.');
  }

  if (loading) return null;
  if (!point && !canSet) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>PUNCT DE ÎNTÂLNIRE</Text>
      {point ? (
        <>
          <View style={styles.mapWrap}>
            <Image source={{ uri: buildExactStaticMapUrl(point.lng, point.lat, scheme, 640, 220) }} style={styles.mapImage} resizeMode="cover" />
          </View>
          <Text style={[styles.setByText, { color: theme.textSecondary }]}>Setat de {senderName(point.setBy)}</Text>
          <View style={styles.actionsRow}>
            <AnimatedPressable
              onPress={() => Linking.openURL(buildDirectionsUrl(point.lng, point.lat)).catch(() => showAlert('Nu am putut deschide harta', 'Încearcă din nou.'))}
              style={[styles.actionButton, { backgroundColor: theme.surfaceMuted }]}
            >
              <Ionicons name="navigate" size={14} color={colors.green500} />
              <Text style={[styles.actionText, { color: colors.green500 }]}>Navighează</Text>
            </AnimatedPressable>
            {canSet && (
              <AnimatedPressable onPress={handleSetHere} disabled={saving} style={[styles.actionButton, { backgroundColor: theme.surfaceMuted }]}>
                {saving ? <ActivityIndicator size="small" color={theme.textSecondary} /> : <Ionicons name="location" size={14} color={theme.textSecondary} />}
                <Text style={[styles.actionText, { color: theme.textSecondary }]}>Mută-l aici</Text>
              </AnimatedPressable>
            )}
          </View>
        </>
      ) : (
        <AnimatedPressable onPress={handleSetHere} disabled={saving} style={[styles.setButton, { backgroundColor: colors.green500, opacity: saving ? 0.6 : 1 }]}>
          <Ionicons name="location-outline" size={15} color={colors.white} />
          <Text style={styles.setButtonText}>{saving ? 'Se setează...' : 'Setează aici punctul de întâlnire'}</Text>
        </AnimatedPressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 8 },
  cardLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  mapWrap: { borderRadius: 14, overflow: 'hidden', height: 130 },
  mapImage: { width: '100%', height: '100%' },
  setByText: { fontSize: 11 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1, height: 38, borderRadius: 12 },
  actionText: { fontSize: 12, fontWeight: '800' },
  setButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 14 },
  setButtonText: { color: colors.white, fontSize: 13, fontWeight: '800' },
});
