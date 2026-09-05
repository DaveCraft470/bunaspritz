import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useEvents } from '@/contexts/EventsContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { Avatar } from '@/components/common/Avatar';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { EventAttendee, fetchAttendees, getEventAttendeeCount } from '@/lib/events';

export default function OrganizerParticipants() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { events, loading: eventsLoading, error: eventsError, refresh } = useEvents();
  const { user } = useUser();
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const event = useMemo(() => events.find((item) => item.id === id), [events, id]);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [attendeeCount, setAttendeeCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!event || !user || event.hostId !== user.id) return;
    setError(false);
    try {
      const [nextAttendees, nextCount] = await Promise.all([
        fetchAttendees(event.id),
        getEventAttendeeCount(event.id),
      ]);
      setAttendees(nextAttendees);
      setAttendeeCount(nextCount);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [event, user]);

  useEffect(() => {
    load();
  }, [load]);

  if (eventsLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
        <StatusBar style={theme.statusBar} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.green500} />
          <Text style={[styles.message, { color: theme.textSecondary }]}>Se încarcă evenimentul...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (eventsError) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
        <StatusBar style={theme.statusBar} />
        <View style={styles.centered}>
          <Text style={[styles.message, { color: theme.textSecondary }]}>Nu am putut încărca evenimentul.</Text>
          <AnimatedPressable onPress={() => void refresh()} style={[styles.retry, { borderColor: theme.border }]}>
            <Text style={[styles.retryText, { color: theme.textPrimary }]}>Reîncearcă</Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!event || !user || event.hostId !== user.id) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
        <StatusBar style={theme.statusBar} />
        <AnimatedPressable onPress={() => router.back()} style={[styles.retry, { borderColor: theme.border }]}>
          <Text style={[styles.retryText, { color: theme.textPrimary }]}>Înapoi</Text>
        </AnimatedPressable>
        <Text style={[styles.message, { color: theme.textPrimary }]}>Nu ai acces la participanții acestui eveniment.</Text>
      </SafeAreaView>
    );
  }

  function requestKick(attendee: EventAttendee) {
    light();
    Alert.alert(
      'Elimină participant',
      `Sigur vrei să-l elimini pe @${attendee.username} din eveniment?`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Elimină',
          style: 'destructive',
          onPress: () => {
            setAttendees((current) => current.filter((item) => item.userId !== attendee.userId));
            setAttendeeCount((current) => (current === null ? current : Math.max(0, current - 1)));
            Alert.alert('Pregătit local', 'Eliminarea este doar locală momentan. Persistența sigură necesită un RPC Supabase care verifică hostul.');
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />
      <FlatList
        data={attendees}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.green500}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.topBar}>
              <AnimatedPressable onPress={() => router.back()} hitSlop={10} style={[styles.backButton, shadows.soft, { borderColor: glassButton.border }]}>
                <Ionicons name="chevron-back" size={20} color={glassButton.icon} />
              </AnimatedPressable>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Participanți</Text>
              <View style={styles.backButton} />
            </View>
            <Text style={[styles.eventTitle, { color: theme.textPrimary }]}>{event.title}</Text>
            <Text style={[styles.count, { color: theme.textSecondary }]}>
              {attendeeCount === null ? 'Se încarcă...' : `${attendeeCount}${event.maxParticipants !== null ? ` / ${event.maxParticipants}` : ''}`} participanți
            </Text>
            <Text style={[styles.localNote, { color: theme.textSecondary }]}>KICK-ul este pregătit local; salvarea permanentă necesită backend.</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.green500} style={styles.loader} />
          ) : error ? (
            <View style={styles.centered}>
              <Text style={[styles.message, { color: theme.textSecondary }]}>Nu am putut încărca participanții.</Text>
              <AnimatedPressable onPress={load} style={[styles.retry, { borderColor: theme.border }]}>
                <Text style={[styles.retryText, { color: theme.textPrimary }]}>Reîncearcă</Text>
              </AnimatedPressable>
            </View>
          ) : (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>Nimeni nu s-a înscris încă.</Text>
          )
        }
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Avatar uri={item.avatarUrl} name={item.name} size={48} fontSize={18} />
            <View style={styles.rowText}>
              <Text style={[styles.name, { color: theme.textPrimary }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.username, { color: theme.textSecondary }]} numberOfLines={1}>@{item.username}</Text>
              <AnimatedPressable onPress={() => router.push(`/user/${item.userId}`)}>
                <Text style={[styles.profileLink, { color: theme.accent }]}>Vezi profil</Text>
              </AnimatedPressable>
            </View>
            {item.userId !== user.id && (
              <AnimatedPressable onPress={() => requestKick(item)} hitSlop={10} style={styles.menu}>
                <Ionicons name="ellipsis-horizontal" size={22} color={theme.textSecondary} />
              </AnimatedPressable>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 50 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  eventTitle: { fontSize: 22, fontWeight: '800' },
  count: { fontSize: 14, fontWeight: '700', marginTop: 5 },
  localNote: { fontSize: 11, fontStyle: 'italic', lineHeight: 16, marginTop: 8, marginBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 11, marginBottom: 10 },
  rowText: { flex: 1 },
  name: { fontSize: 14, fontWeight: '800' },
  username: { fontSize: 11, marginTop: 2 },
  profileLink: { fontSize: 11, fontWeight: '800', marginTop: 5 },
  menu: { padding: 7 },
  loader: { marginTop: 40 },
  centered: { alignItems: 'center' },
  message: { textAlign: 'center', padding: 24, fontSize: 15 },
  empty: { textAlign: 'center', paddingVertical: 40, fontSize: 14 },
  retry: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { fontSize: 13, fontWeight: '800' },
});
