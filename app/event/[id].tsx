import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildApproxStaticMapUrl } from '@/constants/mapbox';
import { getSpritzEvent, SPRITZ_SONGS } from '@/constants/events';
import { colors, shadows } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useNavVisibility } from '@/contexts/NavVisibilityContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { useEvents } from '@/contexts/EventsContext';
import { EventAttendee, fetchAttendees, hasJoined, joinEvent } from '@/lib/events';
import { getProfile } from '@/lib/social';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Avatar } from '@/components/common/Avatar';
import { CelebrationOverlay } from '@/components/event/CelebrationOverlay';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function formatEventStart(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  const now = new Date();
  const dayPart =
    date.toDateString() === now.toDateString()
      ? 'Azi'
      : date.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' });
  const timePart = date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  return `${dayPart} · ${timePart}`;
}

function formatPrice(value: number | null) {
  if (value === null) return null;
  if (value === 0) return 'Gratis';
  return `${value} RON`;
}

export default function EventDetail() {
  const { id, originX, originY } = useLocalSearchParams<{ id: string; originX?: string; originY?: string }>();
  const { events } = useEvents();
  const event = getSpritzEvent(events, id);
  const insets = useSafeAreaInsets();
  const { scheme, colors: theme } = useAppTheme();
  const { setHidden } = useNavVisibility();
  const { light, medium } = useHaptics();
  const { user } = useUser();
  const [celebrating, setCelebrating] = useState(false);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [hostName, setHostName] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!event || !user) return;
    fetchAttendees(event.id).then(setAttendees);
    hasJoined(event.id, user.id).then(setJoined);
    getProfile(event.hostId).then((host) => setHostName(host?.name ?? null));
  }, [event, user]);

  const isFull = !!event?.maxParticipants && attendees.length >= event.maxParticipants && !joined;

  async function handleJoin() {
    if (!event || !user || isFull) return;

    if (!joined && !user.verified) {
      router.push({ pathname: '/verification', params: { returnTo: `/event/${event.id}` } });
      return;
    }

    medium();
    setCelebrating(true);

    if (!joined) {
      setJoining(true);
      const ok = await joinEvent(event.id, user.id);
      setJoining(false);
      if (ok) {
        setJoined(true);
        fetchAttendees(event.id).then(setAttendees);
      }
    }
  }

  // Grows in from wherever the pin was tapped on the map, instead of a plain
  // slide — the origin point comes from the map's own pixel projection of the
  // marker (see MapboxMap's click handler), and falls back to screen center
  // if it's ever missing (e.g. reached this route another way).
  const originXNum = originX ? Number(originX) : SCREEN_WIDTH / 2;
  const originYNum = originY ? Number(originY) : SCREEN_HEIGHT / 2;
  const enterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enterAnim, { toValue: 1, useNativeDriver: true, friction: 9, tension: 55 }).start();
  }, [enterAnim]);

  function handleBack() {
    light();
    Animated.timing(enterAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => router.back());
  }

  const entranceStyle = {
    opacity: enterAnim,
    transform: [
      { translateX: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [originXNum - SCREEN_WIDTH / 2, 0] }) },
      { translateY: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [originYNum - SCREEN_HEIGHT / 2, 0] }) },
      { scale: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [0.05, 1] }) },
    ],
  };

  // A full page, not a tab — the floating nav (and its 68px bottle button)
  // would otherwise collide with the "Hai la Spritz!" button at the bottom.
  useEffect(() => {
    setHidden(true);
    return () => setHidden(false);
  }, [setHidden]);

  if (!event) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
        <StatusBar style={theme.statusBar} />
        <Text style={{ color: theme.textPrimary, padding: 22 }}>Eveniment negăsit.</Text>
      </SafeAreaView>
    );
  }

  const mapUrl = buildApproxStaticMapUrl(event.lng, event.lat, scheme);

  return (
    <View style={styles.root}>
      <Animated.View
        style={[styles.animatedRoot, entranceStyle]}
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
      >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
        <StatusBar style={theme.statusBar} />

        <View style={styles.topBar}>
          <AnimatedPressable
            onPress={handleBack}
            hitSlop={10}
            accessibilityLabel="Înapoi"
            style={[styles.backButton, shadows.soft, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Ionicons name="chevron-back" size={20} color={theme.textPrimary} />
          </AnimatedPressable>
          <Text numberOfLines={1} style={[styles.topBarTitle, { color: theme.textPrimary }]}>
            {event.title}
          </Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 140 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.hero, { backgroundColor: event.color }]}>
            <Text style={styles.heroEmoji}>{event.emoji}</Text>
          </View>
          <Text style={[styles.title, { color: theme.textPrimary }]}>{event.title}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{event.detail}</Text>
          {hostName && (
            <Text style={[styles.hostLine, { color: theme.textSecondary }]}>Găzduit de {hostName}</Text>
          )}

          {(formatEventStart(event.startsAt) ||
            event.entryFeeRon !== null ||
            event.drinksPriceRon !== null ||
            event.maxParticipants !== null ||
            event.locationIsRented === true) && (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {formatEventStart(event.startsAt) && (
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={16} color={colors.green500} />
                  <Text style={[styles.infoRowText, { color: theme.textPrimary }]}>{formatEventStart(event.startsAt)}</Text>
                </View>
              )}
              {event.entryFeeRon !== null && (
                <View style={styles.infoRow}>
                  <Ionicons name="ticket-outline" size={16} color={colors.green500} />
                  <Text style={[styles.infoRowText, { color: theme.textPrimary }]}>
                    Intrare: {formatPrice(event.entryFeeRon)}
                  </Text>
                </View>
              )}
              {event.drinksPriceRon !== null && (
                <View style={styles.infoRow}>
                  <Ionicons name="wine-outline" size={16} color={colors.green500} />
                  <Text style={[styles.infoRowText, { color: theme.textPrimary }]}>
                    Băuturi de la {formatPrice(event.drinksPriceRon)}
                  </Text>
                </View>
              )}
              {event.maxParticipants !== null && (
                <View style={styles.infoRow}>
                  <Ionicons name="people-outline" size={16} color={colors.green500} />
                  <Text style={[styles.infoRowText, { color: theme.textPrimary }]}>
                    Max {event.maxParticipants} persoane
                  </Text>
                </View>
              )}
              {event.locationIsRented === true && (
                <View style={styles.infoRow}>
                  <Ionicons name="key-outline" size={16} color={colors.green500} />
                  <Text style={[styles.infoRowText, { color: theme.textPrimary }]}>
                    Locație închiriată{event.rentalProofPath ? ' · cu dovadă' : ''}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>LOCAȚIE APROXIMATIVĂ</Text>
            <View style={styles.mapWrap}>
              <Image source={{ uri: mapUrl }} style={styles.mapImage} resizeMode="cover" />
              <View style={styles.mapCircle} pointerEvents="none" />
            </View>
            <Text style={[styles.mapHint, { color: theme.textSecondary }]}>
              Locația exactă apare doar celor confirmați.
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>CINE VINE</Text>
            <Text style={[styles.attendeeCount, { color: theme.textPrimary }]}>
              {attendees.length}{event.maxParticipants !== null ? ` / ${event.maxParticipants}` : ''} persoane
            </Text>
            <View style={styles.attendeeRow}>
              {attendees.map((attendee) => (
                <View key={attendee.userId} style={styles.attendeeItem}>
                  <Avatar uri={attendee.avatarUrl} name={attendee.name} size={44} fontSize={16} style={styles.attendeeAvatar} />
                  <Text numberOfLines={1} style={[styles.attendeeName, { color: theme.textSecondary }]}>
                    {attendee.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>MUZICA</Text>
            <Text style={[styles.genre, { color: theme.textPrimary }]}>{event.genre}</Text>
            {SPRITZ_SONGS.map((song) => (
              <View key={song.title} style={styles.songRow}>
                {song.image ? (
                  <Image source={{ uri: song.image }} style={styles.songArt} />
                ) : (
                  <View style={[styles.songArt, styles.songArtFallback]}>
                    <Text style={styles.songArtFallbackEmoji}>🎤</Text>
                  </View>
                )}
                <View style={styles.songText}>
                  <Text numberOfLines={1} style={[styles.songTitle, { color: theme.textPrimary }]}>
                    {song.title}
                  </Text>
                  <Text numberOfLines={1} style={[styles.songArtist, { color: theme.textSecondary }]}>
                    {song.artist}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={[styles.ctaWrap, { paddingBottom: insets.bottom + 20 }]}>
          <AnimatedPressable
            onPress={handleJoin}
            disabled={isFull}
            style={[styles.ctaButton, shadows.glowGreen, isFull && styles.ctaButtonDisabled]}
          >
            <Text style={styles.ctaText}>
              {joined ? 'Ești în listă ✓' : joining ? 'Se confirmă...' : isFull ? 'Eveniment plin 🙁' : 'Hai la Spritz! 🍻'}
            </Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
      </Animated.View>

      {/* Rendered outside the animated wrapper so it covers the whole screen,
          notch/status-bar included, and isn't shrunk by the entrance/exit
          transform (it's a separate, later, user-triggered overlay). */}
      {celebrating ? <CelebrationOverlay onDone={() => setCelebrating(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  animatedRoot: { flex: 1 },
  safeArea: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: { flex: 1, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  content: { paddingHorizontal: 18, gap: 14 },
  hero: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  heroEmoji: { fontSize: 42 },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 },
  subtitle: { fontSize: 13, textAlign: 'center', marginBottom: 4 },
  hostLine: { fontSize: 11, textAlign: 'center', marginBottom: 4, fontStyle: 'italic' },
  card: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  infoRowText: { fontSize: 14, fontWeight: '700' },
  cardLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  mapWrap: { borderRadius: 14, overflow: 'hidden', height: 150 },
  mapImage: { width: '100%', height: '100%' },
  mapCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 120,
    height: 120,
    marginTop: -60,
    marginLeft: -60,
    borderRadius: 60,
    backgroundColor: 'rgba(31,212,96,0.28)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  mapHint: { fontSize: 11, fontStyle: 'italic' },
  attendeeCount: { fontSize: 18, fontWeight: '800' },
  attendeeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 2 },
  attendeeItem: { alignItems: 'center', width: 52 },
  attendeeAvatar: { width: 44, height: 44, borderRadius: 22 },
  attendeeName: { fontSize: 10, marginTop: 4 },
  genre: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  songRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  songArt: { width: 46, height: 46, borderRadius: 10 },
  songArtFallback: { backgroundColor: colors.green100, alignItems: 'center', justifyContent: 'center' },
  songArtFallbackEmoji: { fontSize: 20 },
  songText: { flex: 1 },
  songTitle: { fontSize: 14, fontWeight: '700' },
  songArtist: { fontSize: 12, marginTop: 2 },
  ctaWrap: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 0,
  },
  ctaButton: {
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonDisabled: { opacity: 0.6 },
  ctaText: { color: colors.white, fontSize: 18, fontWeight: '900', letterSpacing: -0.2 },
});
