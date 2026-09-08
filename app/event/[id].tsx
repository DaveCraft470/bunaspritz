import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Image, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { showAlert, showConfirm } from '@/lib/alert';
import { alertPermissionDenied } from '@/lib/permissions';
import { buildApproxStaticMapUrl, buildDirectionsUrl, buildExactStaticMapUrl } from '@/constants/mapbox';
import { getSpritzEvent, SPRITZ_SONGS } from '@/constants/events';
import { colors, shadows } from '@/constants/theme';
import { VERIFICATION_REQUIRED } from '@/constants/featureFlags';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useNavVisibility } from '@/contexts/NavVisibilityContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Translations } from '@/lib/i18n/ro';
import { useUser } from '@/contexts/UserContext';
import { useStories } from '@/contexts/StoriesContext';
import { useEvents } from '@/contexts/EventsContext';
import {
  CHECK_IN_MAX_DISTANCE_METERS,
  cancelJoinRequest,
  checkInToEvent,
  deleteEvent,
  EventAttendee,
  fetchAttendees,
  getEventAttendeeCount,
  getJoinRequestStatus,
  getMyAttendance,
  getUserJoinedEventIds,
  hasJoined,
  joinEvent,
  leaveEvent,
  requestToJoinEvent,
  uploadCheckInPhoto,
  type AttendanceStatus,
  type JoinRequestStatus,
} from '@/lib/events';
import { distanceKm } from '@/lib/recommendations';
import { getProfile, type Profile } from '@/lib/social';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Avatar } from '@/components/common/Avatar';
import { CelebrationOverlay } from '@/components/event/CelebrationOverlay';
import { PartyMeter } from '@/components/event/PartyMeter';
import { ReportModal } from '@/components/social/ReportModal';
import { SafetyMenu } from '@/components/social/SafetyMenu';
import { EventInviteModal } from '@/components/social/EventInviteModal';
import { StoriesRow, type StoryGroup } from '@/components/stories/StoriesRow';
import { StoryViewer } from '@/components/stories/StoryViewer';
import { EVENT_REPORT_REASONS } from '@/lib/reports';
import { getFriends } from '@/lib/friendRequests';
import { sendEventInvitation } from '@/lib/eventInvitations';
import { isEventSaved, saveEvent, unsaveEvent } from '@/lib/savedEvents';
import { recordEventView } from '@/lib/recentActivity';
import { findConflictingEvent } from '@/lib/eventConflicts';
import { getFavoriteCategories, getFavoriteCategoriesFor } from '@/lib/favorites';
import { MeetupPointCard } from '@/components/event/MeetupPointCard';
import { TravelTimeCard } from '@/components/event/TravelTimeCard';
import { PhotoAlbum } from '@/components/event/PhotoAlbum';
import { WeatherCard } from '@/components/event/WeatherCard';
import { CarpoolSection } from '@/components/event/CarpoolSection';
import { QrModal } from '@/components/common/QrModal';
import { buildEventDeepLink, shareEvent } from '@/lib/sharing';
import { formatDrinkVolume, getEventDrinks } from '@/lib/drinks';
import { getEventSongs } from '@/lib/music';
import { MusicCoverPlaceholder } from '@/components/music/MusicCoverPlaceholder';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function formatEventStart(iso: string | null, t: Translations, locale: string) {
  if (!iso) return null;
  const date = new Date(iso);
  const now = new Date();
  const dayPart =
    date.toDateString() === now.toDateString()
      ? t.event.today
      : date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const timePart = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return `${dayPart} · ${timePart}`;
}

function formatPrice(value: number | null, t: Translations) {
  if (value === null) return null;
  if (value === 0) return t.event.free;
  return `${value} RON`;
}

export default function EventDetail() {
  const { id, originX, originY } = useLocalSearchParams<{ id: string; originX?: string; originY?: string }>();
  const { events, loading: eventsLoading, error: eventsError, refresh, removeEvent } = useEvents();
  const event = getSpritzEvent(events, id);
  const insets = useSafeAreaInsets();
  const { scheme, colors: theme } = useAppTheme();
  const { setHidden } = useNavVisibility();
  const { light, medium } = useHaptics();
  const { t, locale } = useLanguage();
  const { user, effectiveVerified } = useUser();
  const { getEventStories } = useStories();
  const [celebrating, setCelebrating] = useState(false);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  // A separate, privacy-safe true count — attendees (above) comes from
  // visible_event_attendees, which can undercount for viewers that someone
  // has hidden their activity from, and this drives capacity so it can't be
  // wrong in either direction.
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [hostProfile, setHostProfile] = useState<Profile | null>(null);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinRequestStatus, setJoinRequestStatus] = useState<JoinRequestStatus>('none');
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [safetyMenuOpen, setSafetyMenuOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteFriends, setInviteFriends] = useState<Awaited<ReturnType<typeof getFriends>>>([]);
  const [viewerStories, setViewerStories] = useState<StoryGroup | null>(null);
  const [attendance, setAttendance] = useState<AttendanceStatus>({ checkedIn: false, method: null });
  const [distanceToEventM, setDistanceToEventM] = useState<number | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [myCategories, setMyCategories] = useState<string[]>([]);
  const [attendeeCategories, setAttendeeCategories] = useState<Record<string, string[]>>({});
  const [qrModalVisible, setQrModalVisible] = useState(false);

  useEffect(() => {
    if (!event || !user) return;
    fetchAttendees(event.id).then(setAttendees);
    getEventAttendeeCount(event.id).then(setAttendeeCount);
    hasJoined(event.id, user.id).then(setJoined);
    getMyAttendance(event.id, user.id).then(setAttendance);
    if (event.approvalMode === 'manual' && event.hostId !== user.id) {
      getJoinRequestStatus(event.id, user.id).then(setJoinRequestStatus);
    }
    if (event.hostId) getProfile(event.hostId).then(setHostProfile);
    getFriends(user.id).then(setInviteFriends);
    isEventSaved(user.id, event.id).then(setSaved);
    recordEventView(event.id);
  }, [event, user]);

  useEffect(() => {
    if (!user) return;
    getFavoriteCategories(user.id).then(setMyCategories);
  }, [user]);

  useEffect(() => {
    if (!attendees.length) return;
    getFavoriteCategoriesFor(attendees.map((a) => a.userId)).then(setAttendeeCategories);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendees.map((a) => a.userId).join(',')]);

  // "Event Matching": attendees you're not already friends with who share at
  // least one favorite category with you — a lightweight "people you might
  // click with here" signal, distinct from friendsParticipating above (which
  // is about people you already know).
  const matchedAttendees = useMemo(() => {
    if (!user || !myCategories.length) return [];
    const friendIds = new Set(inviteFriends.map((f) => f.id));
    const myCategorySet = new Set(myCategories);
    return attendees
      .filter((a) => a.userId !== user.id && !friendIds.has(a.userId))
      .map((a) => ({
        attendee: a,
        shared: (attendeeCategories[a.userId] ?? []).filter((c) => myCategorySet.has(c)),
      }))
      .filter((entry) => entry.shared.length > 0)
      .sort((left, right) => right.shared.length - left.shared.length)
      .slice(0, 5);
  }, [attendees, attendeeCategories, myCategories, inviteFriends, user]);

  async function handleToggleSave() {
    if (!event || !user || savingBookmark) return;
    light();
    const next = !saved;
    setSaved(next);
    setSavingBookmark(true);
    const ok = next ? await saveEvent(user.id, event.id) : await unsaveEvent(user.id, event.id);
    setSavingBookmark(false);
    if (!ok) setSaved(!next);
  }

  const isHost = !!user && !!event && user.id === event.hostId;
  const eventStories = event ? getEventStories(event.id) : [];
  const eventDrinks = event ? getEventDrinks(event.id) : [];
  const eventSongs = event ? getEventSongs(event.id) : [];
  function attendeeName(userId: string): string {
    if (userId === user?.id) return 'Tu';
    if (userId === hostProfile?.id) return hostProfile!.name;
    return attendees.find((a) => a.userId === userId)?.name ?? 'Cineva';
  }

  function attendeeProfile(userId: string): { name: string; avatarUrl: string | null } {
    if (userId === user?.id) return { name: 'Tu', avatarUrl: user?.avatarUrl ?? null };
    if (userId === hostProfile?.id) return { name: hostProfile!.name, avatarUrl: hostProfile!.avatar_url };
    const found = attendees.find((a) => a.userId === userId);
    return { name: found?.name ?? 'Cineva', avatarUrl: found?.avatarUrl ?? null };
  }

  const friendsParticipating = useMemo(() => {
    const attendeeIds = new Set(attendees.map((attendee) => attendee.userId));
    return inviteFriends.filter((friend) => attendeeIds.has(friend.id));
  }, [attendees, inviteFriends]);
  const isPast = !!event?.startsAt && new Date(event.startsAt).getTime() < Date.now();
  const canInviteFriends = !!user && (isHost || joined) && !isPast;
  const isFull = !!event?.maxParticipants && attendeeCount >= event.maxParticipants && !joined;
  const showAttendanceCard = !!event && !!user && joined && !isHost;
  const showCheckInCard = showAttendanceCard && !attendance.checkedIn;
  const withinCheckInRange = distanceToEventM !== null && distanceToEventM <= CHECK_IN_MAX_DISTANCE_METERS;

  // Only ever used to enable/disable the check-in button and show a live
  // distance hint — the check_in_to_event RPC re-checks distance server-side
  // before it ever writes checked_in_at, so a stale or spoofed reading here
  // can't grant a confirmed attendance on its own.
  useEffect(() => {
    if (!event || !showCheckInCard) return;
    let cancelled = false;
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        alertPermissionDenied(permission.canAskAgain, 'Activează locația ca să poți confirma participarea cu o poză.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (cancelled) return;
      const km = distanceKm(
        { lat: position.coords.latitude, lng: position.coords.longitude },
        { lat: event.lat, lng: event.lng }
      );
      setDistanceToEventM(km * 1000);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, showCheckInCard]);

  async function handleCheckIn() {
    if (!event || !user || distanceToEventM === null || !withinCheckInRange) return;
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (!cameraPermission.granted) {
      alertPermissionDenied(cameraPermission.canAskAgain, 'Activează camera ca să poți confirma participarea cu o poză.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;

    setCheckingIn(true);
    // A real device gap: the location permission check above ran before the
    // user physically took the photo, so GPS can genuinely be off by the
    // time getCurrentPositionAsync below runs — same for any transient
    // upload failure. Without this try/finally, either throw left checkingIn
    // stuck true forever (the button frozen on "Se confirmă...") since
    // nothing after the throw ever ran setCheckingIn(false).
    try {
      const asset = result.assets[0];
      const extension = asset.uri.includes('.') ? asset.uri.slice(asset.uri.lastIndexOf('.')) : '.jpg';
      const photoPath = await uploadCheckInPhoto(user.id, event.id, asset.uri, extension, asset.mimeType ?? 'image/jpeg');
      if (!photoPath) {
        showAlert('Nu am putut încărca poza', 'Încearcă din nou.');
        return;
      }

      const freshPosition = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const outcome = await checkInToEvent(event.id, freshPosition.coords.latitude, freshPosition.coords.longitude, photoPath);
      if (!outcome.ok) {
        showAlert('Nu am putut confirma participarea', outcome.error ?? 'Încearcă din nou.');
        return;
      }
      medium();
      setAttendance({ checkedIn: true, method: 'photo' });
    } catch {
      showAlert('Nu am putut confirma participarea', 'Verifică locația și încearcă din nou.');
    } finally {
      setCheckingIn(false);
    }
  }

  async function sendInvitations(recipientIds: string[]) {
    if (!event || !user) return;
    let sent = 0;
    let skipped = 0;
    for (const recipientId of recipientIds) {
      const result = sendEventInvitation(event, user.id, recipientId, user.name);
      if (result.ok) sent += 1;
      else skipped += 1;
    }
    setInviteModalOpen(false);
    if (sent > 0) {
      Alert.alert(t.event.invitationsSentTitle, t.event.invitationsSentMessage(sent));
    } else if (skipped > 0) {
      Alert.alert(t.event.invitationsAlreadySentTitle, t.event.invitationsAlreadySentMessage);
    }
  }

  // The DB has always allowed leaving (see lib/events.ts) but nothing in
  // the app ever exposed it — once max_participants shipped this session,
  // a filled event's spot could never free up even if someone left. Hosts
  // can't leave their own event (would desync it from event_attendees).
  function confirmLeave() {
    if (!event || !user) return;
    light();
    showConfirm(t.event.confirmLeaveTitle, t.event.confirmLeaveMessage(event.title), t.event.leave, t.event.cancel, async () => {
      setJoining(true);
      const ok = await leaveEvent(event.id, user.id);
      setJoining(false);
      if (!ok) {
        showAlert(t.event.genericErrorTitle, t.event.couldNotCancelParticipation);
        return;
      }
      setJoined(false);
      fetchAttendees(event.id).then(setAttendees);
      getEventAttendeeCount(event.id).then(setAttendeeCount);
    });
  }

  // Same DB support gap as leaveEvent: "hosts delete their own events" has
  // been a valid RLS policy since the init migration, but nothing in the app
  // ever called it — a host who published a bad event had no way to take it
  // down. The confirmation names the attendee count, not just the event
  // title, since a host cancelling deletes everyone else's spot too.
  function confirmCancelEvent() {
    if (!event || !user) return;
    light();
    const attendeeNote =
      attendeeCount > 1 ? t.event.attendeeNoteMultiple(attendeeCount) : t.event.attendeeNoteSolo;
    showConfirm(
      t.event.confirmCancelEventTitle,
      t.event.confirmCancelEventMessage(event.title, attendeeNote),
      t.event.cancelEvent,
      t.common.back,
      async () => {
        setJoining(true);
        const ok = await deleteEvent(event.id, user.id, event.rentalProofPath);
        setJoining(false);
        if (!ok) {
          showAlert(t.event.genericErrorTitle, t.event.couldNotCancelEvent);
          return;
        }
        removeEvent(event.id);
        router.back();
      },
    );
  }

  const requiresApproval = !!event && event.approvalMode === 'manual' && !isHost;

  async function handleCancelRequest() {
    if (!event || !user) return;
    light();
    setJoining(true);
    const ok = await cancelJoinRequest(event.id, user.id);
    setJoining(false);
    if (!ok) {
      showAlert('A apărut o eroare', 'Nu am putut anula cererea. Încearcă din nou.');
      return;
    }
    setJoinRequestStatus('none');
  }

  async function handleJoin() {
    if (!event || !user) return;

    if (joined) {
      if (!isHost) confirmLeave();
      return;
    }

    if (requiresApproval && joinRequestStatus === 'pending') {
      handleCancelRequest();
      return;
    }

    if (isFull) return;

    // Client-side heads-up only, not a hard block — a genuine reason to
    // double-book (e.g. hopping between two nearby spritzes) should still be
    // possible. See lib/eventConflicts.ts for the assumed-duration overlap check.
    const joinedIds = await getUserJoinedEventIds(user.id);
    const conflict = findConflictingEvent(
      event,
      events.filter((e) => joinedIds.includes(e.id)),
    );
    if (conflict) {
      const title = '⚠️ Ai deja un eveniment la ora asta';
      const message = `Se suprapune cu „${conflict.title}". Vrei să participi oricum?`;
      const proceed =
        Platform.OS === 'web'
          ? window.confirm(`${title}\n\n${message}`)
          : await new Promise<boolean>((resolve) => {
              Alert.alert(title, message, [
                { text: 'Anulează', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Particip oricum', onPress: () => resolve(true) },
              ]);
            });
      if (!proceed) return;
    }

    if (VERIFICATION_REQUIRED && !effectiveVerified) {
      router.push({ pathname: '/verification', params: { returnTo: `/event/${event.id}` } });
      return;
    }

    if (requiresApproval) {
      setJoining(true);
      const ok = await requestToJoinEvent(event.id, user.id);
      setJoining(false);
      if (!ok) {
        showAlert('A apărut o eroare', 'Nu am putut trimite cererea. Încearcă din nou.');
        return;
      }
      light();
      setJoinRequestStatus('pending');
      return;
    }

    setJoining(true);
    const ok = await joinEvent(event.id, user.id);
    setJoining(false);
    if (!ok) {
      showAlert(t.event.genericErrorTitle, t.event.couldNotConfirmParticipation);
      return;
    }
    medium();
    setCelebrating(true);
    setJoined(true);
    fetchAttendees(event.id).then(setAttendees);
    getEventAttendeeCount(event.id).then(setAttendeeCount);
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
        <View style={styles.missingState}>
          {eventsLoading && <ActivityIndicator color={colors.green500} />}
          <Text style={[styles.missingText, { color: theme.textPrimary }]}>
            {eventsLoading ? t.event.loadingEvent : eventsError ? t.event.couldNotLoadEvent : t.event.eventNotFound}
          </Text>
          {eventsError && (
            <AnimatedPressable onPress={refresh} style={[styles.retryButton, { borderColor: theme.border }]}>
              <Text style={[styles.retryText, { color: theme.textPrimary }]}>{t.event.retry}</Text>
            </AnimatedPressable>
          )}
          <AnimatedPressable onPress={() => router.back()} style={styles.missingBack}>
            <Text style={[styles.retryText, { color: theme.accent }]}>{t.common.back}</Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  }

  const mapUrl = buildApproxStaticMapUrl(event.lng, event.lat, scheme, 640, 300, event.id);
  const exactMapUrl = buildExactStaticMapUrl(event.lng, event.lat, scheme, 640, 300);

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
            accessibilityLabel={t.common.back}
            style={[styles.backButton, shadows.soft, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Ionicons name="chevron-back" size={20} color={theme.textPrimary} />
          </AnimatedPressable>
          <Text numberOfLines={1} style={[styles.topBarTitle, { color: theme.textPrimary }]}>
            {event.title}
          </Text>
          <View style={styles.topBarActions}>
            <AnimatedPressable
              onPress={() => {
                light();
                shareEvent(event);
              }}
              hitSlop={10}
              accessibilityLabel="Distribuie evenimentul"
              style={[styles.backButton, shadows.soft, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Ionicons name="share-outline" size={19} color={theme.textPrimary} />
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => {
                light();
                setQrModalVisible(true);
              }}
              hitSlop={10}
              accessibilityLabel="Arată codul QR"
              style={[styles.backButton, shadows.soft, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Ionicons name="qr-code-outline" size={19} color={theme.textPrimary} />
            </AnimatedPressable>
            <AnimatedPressable
              onPress={handleToggleSave}
              hitSlop={10}
              accessibilityLabel={saved ? t.event.unsaveEvent : t.event.saveEvent}
              style={[styles.backButton, shadows.soft, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={19} color={saved ? colors.green500 : theme.textPrimary} />
            </AnimatedPressable>
            {!isHost && (
              <AnimatedPressable
                onPress={() => {
                  light();
                  setSafetyMenuOpen(true);
                }}
                hitSlop={10}
                accessibilityLabel="Opțiuni de siguranță"
                style={[styles.backButton, shadows.soft, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={theme.textPrimary} />
              </AnimatedPressable>
            )}
          </View>
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
          {hostProfile && (
            <AnimatedPressable
              onPress={() => {
                light();
                router.push(`/user/${event.hostId}`);
              }}
              style={[styles.organizerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Avatar uri={hostProfile.avatar_url} name={hostProfile.name} size={46} fontSize={18} />
              <View style={styles.organizerCopy}>
                <Text style={[styles.organizerLabel, { color: theme.textSecondary }]}>{t.event.organizer}</Text>
                <Text style={[styles.organizerName, { color: theme.textPrimary }]} numberOfLines={1}>{hostProfile.name}</Text>
                <Text style={[styles.organizerUsername, { color: theme.textSecondary }]} numberOfLines={1}>@{hostProfile.username}</Text>
              </View>
              {hostProfile.verified && <Ionicons name="checkmark-circle" size={19} color={theme.accent} />}
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </AnimatedPressable>
          )}
          {event.source === 'scraper' && (
            <AnimatedPressable
              onPress={() => {
                light();
                if (event.sourceUrl) Linking.openURL(event.sourceUrl).catch(() => {});
              }}
            >
              <Text style={[styles.hostLine, { color: theme.textSecondary }]}>{t.event.discoveredOn}</Text>
            </AnimatedPressable>
          )}

          {(formatEventStart(event.startsAt, t, locale) ||
            event.entryFeeRon !== null ||
            event.drinksPriceRon !== null ||
            event.maxParticipants !== null ||
            event.locationIsRented === true ||
            event.visibility === 'private') && (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {event.visibility === 'private' && (
                <View style={styles.infoRow}>
                  <Ionicons name="lock-closed-outline" size={16} color={colors.green500} />
                  <Text style={[styles.infoRowText, { color: theme.textPrimary }]}>
                    Eveniment privat{event.approvalMode === 'manual' ? ' · aprobare manuală' : ''}
                  </Text>
                </View>
              )}
              {formatEventStart(event.startsAt, t, locale) && (
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={16} color={colors.green500} />
                  <Text style={[styles.infoRowText, { color: theme.textPrimary }]}>{formatEventStart(event.startsAt, t, locale)}</Text>
                </View>
              )}
              {event.entryFeeRon !== null && (
                <View style={styles.infoRow}>
                  <Ionicons name="ticket-outline" size={16} color={colors.green500} />
                  <Text style={[styles.infoRowText, { color: theme.textPrimary }]}>
                    {t.event.entry(formatPrice(event.entryFeeRon, t)!)}
                  </Text>
                </View>
              )}
              {event.drinksPriceRon !== null && (
                <View style={styles.infoRow}>
                  <Ionicons name="wine-outline" size={16} color={colors.green500} />
                  <Text style={[styles.infoRowText, { color: theme.textPrimary }]}>
                    {t.event.drinksFrom(formatPrice(event.drinksPriceRon, t)!)}
                  </Text>
                </View>
              )}
              {event.maxParticipants !== null && (
                <View style={styles.infoRow}>
                  <Ionicons name="people-outline" size={16} color={colors.green500} />
                  <Text style={[styles.infoRowText, { color: theme.textPrimary }]}>
                    {t.event.maxPeople(event.maxParticipants)}
                  </Text>
                </View>
              )}
              {event.locationIsRented === true && (
                <View style={styles.infoRow}>
                  <Ionicons name="key-outline" size={16} color={colors.green500} />
                  <Text style={[styles.infoRowText, { color: theme.textPrimary }]}>
                    {t.event.rentedLocation(!!event.rentalProofPath)}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {joined ? (
              <>
                <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>{t.event.exactLocation}</Text>
                <View style={styles.mapWrap}>
                  <Image source={{ uri: exactMapUrl }} style={styles.mapImage} resizeMode="cover" />
                </View>
                <AnimatedPressable
                  onPress={() =>
                    Linking.openURL(buildDirectionsUrl(event.lng, event.lat)).catch(() =>
                      showAlert(t.event.couldNotOpenMap, t.event.tryAgainLater)
                    )
                  }
                  style={[styles.directionsButton, { backgroundColor: theme.surfaceMuted }]}
                >
                  <Ionicons name="navigate" size={14} color={colors.green500} />
                  <Text style={[styles.directionsText, { color: colors.green500 }]}>{t.event.openInMap}</Text>
                </AnimatedPressable>
              </>
            ) : (
              <>
                <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>{t.event.approxLocation}</Text>
                <View style={styles.mapWrap}>
                  <Image source={{ uri: mapUrl }} style={styles.mapImage} resizeMode="cover" />
                  <View style={styles.mapCircle} pointerEvents="none" />
                </View>
                <Text style={[styles.mapHint, { color: theme.textSecondary }]}>
                  {t.event.exactLocationHint}
                </Text>
              </>
            )}
          </View>

          {showAttendanceCard && (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>CONFIRMĂ PARTICIPAREA</Text>
              {showCheckInCard ? (
                <>
                  <Text style={[styles.checkInHint, { color: theme.textSecondary }]}>
                    {distanceToEventM === null
                      ? 'Se verifică locația ta...'
                      : withinCheckInRange
                        ? 'Ești în zonă ✅ — poți face o poză ca să confirmi.'
                        : `Ești la ~${Math.round(distanceToEventM)} m de eveniment — apropie-te ca să poți confirma.`}
                  </Text>
                  <AnimatedPressable
                    onPress={handleCheckIn}
                    disabled={!withinCheckInRange || checkingIn}
                    style={[
                      styles.checkInButton,
                      { backgroundColor: colors.green500, opacity: !withinCheckInRange || checkingIn ? 0.5 : 1 },
                    ]}
                  >
                    <Ionicons name="camera-outline" size={16} color={colors.white} />
                    <Text style={styles.checkInButtonText}>
                      {checkingIn ? 'Se confirmă...' : 'Fă o poză ca să confirmi 📸'}
                    </Text>
                  </AnimatedPressable>
                </>
              ) : (
                <Text style={[styles.checkInHint, { color: theme.textPrimary }]}>Participare confirmată ✅</Text>
              )}
            </View>
          )}

          {canInviteFriends && (
            <AnimatedPressable
              onPress={() => {
                light();
                setInviteModalOpen(true);
              }}
              style={[styles.inviteFriendsButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Ionicons name="person-add-outline" size={18} color={theme.accent} />
              <Text style={[styles.inviteFriendsText, { color: theme.accent }]}>{t.event.inviteFriends}</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </AnimatedPressable>
          )}

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>{t.event.whosComing}</Text>
            <PartyMeter attendeeCount={attendeeCount} maxParticipants={event.maxParticipants} />
            {!event.maxParticipants && (
              <Text style={[styles.attendeeCount, { color: theme.textPrimary }]}>{t.event.peopleCount(attendeeCount)}</Text>
            )}
            {friendsParticipating.length > 0 && (
              <View style={styles.friendsParticipatingBlock}>
                <Text style={[styles.friendsParticipatingText, { color: theme.accent }]}>
                  {t.event.friendsAttending(friendsParticipating.length)}
                </Text>
                <View style={styles.friendAvatarRow}>
                  {friendsParticipating.slice(0, 4).map((friend) => (
                    <AnimatedPressable key={friend.id} onPress={() => router.push(`/user/${friend.id}`)} style={styles.friendAvatarItem}>
                      <Avatar uri={friend.avatar_url} name={friend.name} size={34} fontSize={14} />
                    </AnimatedPressable>
                  ))}
                  {friendsParticipating.length > 4 && (
                    <View style={[styles.moreFriends, { backgroundColor: theme.surfaceMuted }]}>
                      <Text style={[styles.moreFriendsText, { color: theme.textSecondary }]}>+{friendsParticipating.length - 4}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
            <View style={styles.attendeeRow}>
              {attendees.map((attendee) => (
                <AnimatedPressable
                  key={attendee.userId}
                  style={styles.attendeeItem}
                  onPress={() => {
                    light();
                    router.push(`/user/${attendee.userId}`);
                  }}
                >
                  <View>
                    <Avatar uri={attendee.avatarUrl} name={attendee.name} size={44} fontSize={16} style={styles.attendeeAvatar} />
                    {attendee.goingAlone && (
                      <View style={[styles.aloneBadge, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <Text style={styles.aloneBadgeEmoji}>🧍</Text>
                      </View>
                    )}
                  </View>
                  <Text numberOfLines={1} style={[styles.attendeeName, { color: theme.textSecondary }]}>
                    {attendee.name}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>
            {isHost && (
              <AnimatedPressable
                onPress={() => router.push({ pathname: '/organizer-participants/[id]', params: { id: event.id } })}
                style={[styles.manageParticipantsButton, { borderColor: theme.border }]}
              >
                <Ionicons name="settings-outline" size={15} color={theme.accent} />
                <Text style={[styles.manageParticipantsText, { color: theme.accent }]}>{t.event.manageParticipants}</Text>
              </AnimatedPressable>
            )}
          </View>

          {matchedAttendees.length > 0 && (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>OAMENI CU CARE AI LUCRURI ÎN COMUN</Text>
              {matchedAttendees.map(({ attendee, shared }) => (
                <AnimatedPressable
                  key={attendee.userId}
                  onPress={() => {
                    light();
                    router.push(`/user/${attendee.userId}`);
                  }}
                  style={styles.matchRow}
                >
                  <Avatar uri={attendee.avatarUrl} name={attendee.name} size={38} fontSize={15} />
                  <View style={styles.matchCopy}>
                    <Text style={[styles.matchName, { color: theme.textPrimary }]} numberOfLines={1}>{attendee.name}</Text>
                    <Text style={[styles.matchReason, { color: theme.accent }]} numberOfLines={1}>
                      {shared.length === 1 ? `Vă place amândurora ${shared[0]}` : `${shared.length} interese în comun`}
                    </Text>
                  </View>
                </AnimatedPressable>
              ))}
            </View>
          )}

          {(joined || isHost) && (
            <MeetupPointCard eventId={event.id} userId={user!.id} scheme={scheme} canSet={joined || isHost} senderName={attendeeName} />
          )}

          {(joined || isHost) && !isPast && event.startsAt && (
            <TravelTimeCard eventId={event.id} eventTitle={event.title} destination={{ lat: event.lat, lng: event.lng }} startsAt={event.startsAt} />
          )}

          {!isPast && <WeatherCard event={event} allEvents={events} />}

          {(joined || isHost) && !isPast && (
            <CarpoolSection eventId={event.id} userId={user!.id} profileLookup={attendeeProfile} />
          )}

          {user && (
            <PhotoAlbum eventId={event.id} canUpload={joined || isHost} isHost={isHost} currentUserId={user.id} />
          )}

          {eventStories.length > 0 && (
            <StoriesRow
              stories={eventStories}
              currentUserId={user?.id}
              title={t.event.recentStories}
              compact
              onOpen={(group) => setViewerStories(group)}
            />
          )}

          {eventDrinks.length > 0 && (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>{t.event.drinks}</Text>
              {eventDrinks.map((drink) => (
                <View key={drink.id} style={styles.drinkRow}>
                  <View style={styles.drinkCopy}><Text style={[styles.drinkName, { color: theme.textPrimary }]}>{drink.name}</Text><Text style={[styles.drinkMeta, { color: theme.textSecondary }]}>{formatDrinkVolume(drink.volumeMl)}</Text></View>
                  <Text style={[styles.drinkQuantity, { color: theme.accent }]}>× {drink.quantity}</Text>
                </View>
              ))}
            </View>
          )}

          {eventSongs.length > 0 && (
            <View
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>{t.event.playlist}</Text>
              {eventSongs.slice(0, 4).map((song) => (
                <View key={song.id} style={styles.songRow}>
                  {song.coverUrl ? <Image source={{ uri: song.coverUrl }} style={styles.songCover} /> : <MusicCoverPlaceholder size={38} />}
                  <View style={styles.songText}><Text style={[styles.songTitle, { color: theme.textPrimary }]} numberOfLines={1}>{song.title}</Text><Text style={[styles.songArtist, { color: theme.textSecondary }]} numberOfLines={1}>{song.artist}</Text></View>
                </View>
              ))}
              {eventSongs.length > 4 && <Text style={[styles.moreSongs, { color: theme.accent }]}>{t.event.moreSongs(eventSongs.length - 4)}</Text>}
            </View>
          )}

          {eventSongs.length === 0 && (
            <View
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
            <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>{t.event.music}</Text>
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
          )}

          {isHost && (
            <>
              <AnimatedPressable
                onPress={() => router.push({ pathname: '/edit-event/[id]', params: { id: event.id } })}
                style={[styles.editEventButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <Ionicons name="create-outline" size={15} color={theme.accent} />
                <Text style={[styles.editEventText, { color: theme.accent }]}>{t.event.editEvent}</Text>
              </AnimatedPressable>
              <AnimatedPressable onPress={confirmCancelEvent} style={styles.cancelEventButton}>
                <Ionicons name="trash-outline" size={14} color="#E5484D" />
                <Text style={styles.cancelEventText}>{t.event.cancelEvent}</Text>
              </AnimatedPressable>
            </>
          )}
        </ScrollView>

        <View style={[styles.ctaWrap, { paddingBottom: insets.bottom + 20 }]}>
          <AnimatedPressable
            onPress={handleJoin}
            disabled={(isFull && !joined && joinRequestStatus !== 'pending') || (joined && isHost) || joining}
            style={[styles.ctaButton, shadows.glowGreen, isFull && !joined && joinRequestStatus !== 'pending' && styles.ctaButtonDisabled]}
          >
            <Text style={styles.ctaText}>
              {joining
                ? t.event.ctaProcessing
                : joined
                  ? isHost
                    ? t.event.ctaHosting
                    : t.event.ctaJoinedLeave
                  : requiresApproval && joinRequestStatus === 'pending'
                    ? 'Cerere trimisă ✓ · Anulează'
                    : isFull
                      ? t.event.ctaFull
                      : requiresApproval
                        ? 'Cere să participi 🙋'
                        : t.event.ctaJoin}
            </Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
      </Animated.View>

      {/* Rendered outside the animated wrapper so it covers the whole screen,
          notch/status-bar included, and isn't shrunk by the entrance/exit
          transform (it's a separate, later, user-triggered overlay). */}
      {celebrating ? <CelebrationOverlay onDone={() => setCelebrating(false)} /> : null}
      {event && user ? (
        <EventInviteModal
          visible={inviteModalOpen}
          eventId={event.id}
          senderId={user.id}
          friends={inviteFriends.filter((friend) => friend.id !== user.id)}
          joinedIds={new Set(attendees.map((attendee) => attendee.userId))}
          theme={theme}
          onClose={() => setInviteModalOpen(false)}
          onSend={sendInvitations}
        />
      ) : null}
      <StoryViewer
        visible={!!viewerStories}
        stories={viewerStories?.stories ?? []}
        currentUserId={user?.id}
        onClose={() => setViewerStories(null)}
        onEventPress={() => setViewerStories(null)}
      />
      <QrModal visible={qrModalVisible} title={event.title} link={buildEventDeepLink(event.id)} onClose={() => setQrModalVisible(false)} />
      {event && user ? (
        <ReportModal
          visible={reportModalOpen}
          targetType="event"
          targetId={event.id}
          targetLabel={event.title}
          reasons={EVENT_REPORT_REASONS}
          reporterId={user.id}
          reporterLabel={`@${user.username}`}
          onClose={() => setReportModalOpen(false)}
        />
      ) : null}
      {event && (
        <SafetyMenu
          visible={safetyMenuOpen}
          title={event.title}
          onClose={() => setSafetyMenuOpen(false)}
          actions={[
            {
              key: 'report',
              label: 'Raportează evenimentul',
              icon: 'flag-outline',
              onPress: () => setReportModalOpen(true),
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  missingState: { alignItems: 'center', justifyContent: 'center', flex: 1, padding: 24 },
  missingText: { fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 12 },
  retryButton: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginTop: 16 },
  retryText: { fontSize: 13, fontWeight: '700' },
  missingBack: { padding: 12, marginTop: 4 },
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
  topBarActions: { flexDirection: 'row', gap: 8 },
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
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center', lineHeight: 30 },
  subtitle: { fontSize: 13, textAlign: 'center', marginBottom: 4 },
  hostLine: { fontSize: 11, textAlign: 'center', marginBottom: 4, fontStyle: 'italic' },
  card: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 8 },
  organizerCard: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 16, borderWidth: 1, padding: 12 },
  organizerCopy: { flex: 1, minWidth: 0 },
  organizerLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  organizerName: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  organizerUsername: { fontSize: 11, marginTop: 1 },
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
  checkInHint: { fontSize: 12, lineHeight: 17 },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 14,
    marginTop: 2,
  },
  checkInButtonText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 12,
    marginTop: 2,
  },
  directionsText: { fontSize: 13, fontWeight: '800' },
  attendeeCount: { fontSize: 18, fontWeight: '800' },
  friendsParticipatingBlock: { gap: 7, marginTop: 2, paddingVertical: 3 },
  friendsParticipatingText: { fontSize: 12, fontWeight: '800' },
  friendAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  friendAvatarItem: { padding: 1 },
  moreFriends: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  moreFriendsText: { fontSize: 11, fontWeight: '800' },
  attendeeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 2 },
  manageParticipantsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingVertical: 10, marginTop: 14 },
  manageParticipantsText: { fontSize: 12, fontWeight: '800' },
  inviteFriendsButton: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 15, borderWidth: 1, padding: 13 },
  inviteFriendsText: { flex: 1, fontSize: 13, fontWeight: '800' },
  drinkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  drinkCopy: { flex: 1, minWidth: 0 },
  drinkName: { fontSize: 13, fontWeight: '800' },
  drinkMeta: { fontSize: 11, marginTop: 2 },
  drinkQuantity: { fontSize: 13, fontWeight: '900' },
  songCover: { width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  moreSongs: { fontSize: 11, fontWeight: '800', marginTop: 2 },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  matchCopy: { flex: 1, minWidth: 0 },
  matchName: { fontSize: 13, fontWeight: '800' },
  matchReason: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  aloneBadge: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  aloneBadgeEmoji: { fontSize: 9 },
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
  cancelEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
    paddingVertical: 10,
  },
  editEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  editEventText: { fontSize: 13, fontWeight: '800' },
  cancelEventText: { fontSize: 13, fontWeight: '700', color: '#E5484D' },
  reportEventButton: { alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingVertical: 10, marginTop: 10 },
  reportEventText: { fontSize: 12, fontWeight: '700' },
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
