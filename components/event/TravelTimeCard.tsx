import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { getTravelEstimates, type TravelEstimates } from '@/lib/travelTime';
import {
  cancelDepartureReminder,
  getScheduledDepartureReminder,
  scheduleDepartureReminder,
} from '@/lib/departureReminder';
import { showAlert } from '@/lib/alert';

// How long before "you should leave now" to actually fire the reminder —
// a little slack on top of the raw travel estimate.
const DEPARTURE_BUFFER_MINUTES = 10;

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}

// Travel Time + Smart Departure Reminder live together since the reminder's
// fire time is derived straight from the travel estimate — splitting them
// into two cards would just mean passing the same estimate across anyway.
export function TravelTimeCard({
  eventId,
  eventTitle,
  destination,
  startsAt,
}: {
  eventId: string;
  eventTitle: string;
  destination: { lat: number; lng: number };
  startsAt: string;
}) {
  const { colors: theme } = useAppTheme();
  const [estimates, setEstimates] = useState<TravelEstimates | null>(null);
  const [loading, setLoading] = useState(true);
  const [reminderOn, setReminderOn] = useState(false);
  const [togglingReminder, setTogglingReminder] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) {
        setLoading(false);
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (cancelled) return;
      const result = await getTravelEstimates({ lat: position.coords.latitude, lng: position.coords.longitude }, destination);
      if (!cancelled) setEstimates(result);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    getScheduledDepartureReminder(eventId).then((id) => setReminderOn(!!id));
  }, [eventId]);

  const bestMinutes = estimates?.drivingMinutes ?? estimates?.walkingMinutes ?? null;

  async function handleToggleReminder(value: boolean) {
    if (togglingReminder) return;
    setTogglingReminder(true);
    if (!value) {
      await cancelDepartureReminder(eventId);
      setReminderOn(false);
      setTogglingReminder(false);
      return;
    }
    if (bestMinutes === null) {
      setTogglingReminder(false);
      showAlert('Nu am putut estima timpul de drum', 'Activează locația ca să poți seta o notificare de plecare.');
      return;
    }
    const leaveAt = new Date(new Date(startsAt).getTime() - (bestMinutes + DEPARTURE_BUFFER_MINUTES) * 60 * 1000);
    const ok = await scheduleDepartureReminder(eventId, eventTitle, leaveAt);
    setTogglingReminder(false);
    if (ok) {
      setReminderOn(true);
    } else {
      showAlert('Nu am putut seta notificarea', 'Verifică permisiunile de notificări sau ora evenimentului.');
    }
  }

  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <ActivityIndicator color={colors.green500} />
      </View>
    );
  }

  if (!estimates || (estimates.walkingMinutes === null && estimates.drivingMinutes === null)) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>TIMP DE DRUM</Text>
      <View style={styles.row}>
        {estimates.drivingMinutes !== null && (
          <View style={styles.estimate}>
            <Ionicons name="car-outline" size={16} color={colors.green500} />
            <Text style={[styles.estimateText, { color: theme.textPrimary }]}>{formatMinutes(estimates.drivingMinutes)}</Text>
          </View>
        )}
        {estimates.walkingMinutes !== null && (
          <View style={styles.estimate}>
            <Ionicons name="walk-outline" size={16} color={colors.green500} />
            <Text style={[styles.estimateText, { color: theme.textPrimary }]}>{formatMinutes(estimates.walkingMinutes)}</Text>
          </View>
        )}
      </View>
      <View style={styles.reminderRow}>
        <Text style={[styles.reminderText, { color: theme.textPrimary }]}>Anunță-mă când e timpul să plec</Text>
        <Switch value={reminderOn} onValueChange={handleToggleReminder} disabled={togglingReminder} trackColor={{ true: colors.green500 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 10 },
  cardLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  row: { flexDirection: 'row', gap: 18 },
  estimate: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  estimateText: { fontSize: 14, fontWeight: '800' },
  reminderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  reminderText: { flex: 1, fontSize: 12, fontWeight: '700', marginRight: 8 },
});
