import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { colors } from '@/constants/theme';
import { SpritzEvent } from '@/constants/events';
import { useAppTheme } from '@/contexts/ThemeContext';
import { getEventWeather, weatherEmoji, type WeatherForecast } from '@/lib/weather';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

// Weather-aware Events + Weather Alert + Indoor Alternative, all in one
// card: the alert and the alternatives only ever make sense in the context
// of this event's own forecast, so splitting them into separate
// cards/queries would just mean threading the same forecast through twice.
export function WeatherCard({ event, allEvents }: { event: SpritzEvent; allEvents: SpritzEvent[] }) {
  const { colors: theme } = useAppTheme();
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!event.startsAt) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    getEventWeather(event.lat, event.lng, event.startsAt).then((result) => {
      if (!cancelled) {
        setForecast(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [event.id, event.startsAt, event.lat, event.lng]);

  if (loading || !forecast || !event.startsAt) return null;

  const showAlert = event.isOutdoor && (forecast.isRainy || forecast.isExtreme);
  const indoorAlternatives = showAlert
    ? allEvents
        .filter(
          (other) =>
            other.id !== event.id &&
            !other.isOutdoor &&
            other.startsAt &&
            new Date(other.startsAt).getTime() > Date.now() &&
            sameDay(new Date(other.startsAt), new Date(event.startsAt!)),
        )
        .sort((a, b) => new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime())
        .slice(0, 3)
    : [];

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.row}>
        <Text style={styles.emoji}>{weatherEmoji(forecast.weatherCode)}</Text>
        <Text style={[styles.temp, { color: theme.textPrimary }]}>{Math.round(forecast.temperatureC)}°C</Text>
        <Text style={[styles.rain, { color: theme.textSecondary }]}>💧 {forecast.precipitationProbability}%</Text>
      </View>

      {showAlert && (
        <View style={styles.alertBlock}>
          <Text style={styles.alertText}>
            {forecast.isRainy ? '⚠️ Probabilitate mare de ploaie — eveniment în aer liber.' : '⚠️ Temperaturi extreme prognozate.'}
          </Text>
          {indoorAlternatives.length > 0 && (
            <>
              <Text style={[styles.alertHint, { color: theme.textSecondary }]}>Alternative în interior, în aceeași zi:</Text>
              {indoorAlternatives.map((alt) => (
                <AnimatedPressable key={alt.id} onPress={() => router.push(`/event/${alt.id}`)}>
                  <Text style={[styles.altLink, { color: colors.green600 }]}>• {alt.emoji} {alt.title}</Text>
                </AnimatedPressable>
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emoji: { fontSize: 22 },
  temp: { fontSize: 16, fontWeight: '800' },
  rain: { fontSize: 12, fontWeight: '700' },
  alertBlock: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 4 },
  alertText: { fontSize: 12, fontWeight: '700', color: '#C24444' },
  alertHint: { fontSize: 11, marginTop: 2 },
  altLink: { fontSize: 12, fontWeight: '700', marginTop: 2 },
});
