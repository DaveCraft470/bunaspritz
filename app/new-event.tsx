import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

import { MAPBOX_INITIAL_VIEW, buildApproxStaticMapUrl } from '@/constants/mapbox';
import { VERIFICATION_REQUIRED } from '@/constants/featureFlags';
import { useEvents } from '@/contexts/EventsContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { createEvent, removeRentalProof, uploadRentalProof } from '@/lib/events';
import { alertPermissionDenied } from '@/lib/permissions';
import { showAlert } from '@/lib/alert';
import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { GlassSurface } from '@/components/common/GlassSurface';
import { LocationPickerModal } from '@/components/event/LocationPickerModal';
import { extensionAndTypeForImage } from '@/lib/media';

const TITLE_MAX_LENGTH = 60;
const DETAIL_MAX_LENGTH = 200;
const GENRE_MAX_LENGTH = 40;

const EMOJI_CHOICES = ['🎉', '🍻', '🎷', '🎸', '🌮', '🎲', '🥾', '🧺', '⛰️', '🍹'];
const COLOR_CHOICES = ['#FF9F5A', '#5FD98A', '#5AA9E6', '#FFD25A', '#FF6B81', '#B388FF', '#4ED9C9'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

function dayLabel(date: Date, index: number) {
  if (index === 0) return 'Azi';
  if (index === 1) return 'Mâine';
  return date.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' });
}

function buildDayOptions() {
  return Array.from({ length: 10 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date;
  });
}

export default function NewEvent() {
  const { colors: theme, scheme } = useAppTheme();
  const { addEvent } = useEvents();
  const { user } = useUser();
  const { light, medium } = useHaptics();
  const [publishing, setPublishing] = useState(false);
  // A ref alongside the state: two taps landing before React commits the
  // first setPublishing(true) could both pass a state-only guard and both
  // insert an event. The ref updates synchronously, closing that window.
  const publishingRef = useRef(false);

  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [genre, setGenre] = useState('');
  const [emoji, setEmoji] = useState(EMOJI_CHOICES[0]);
  const [color, setColor] = useState(COLOR_CHOICES[Math.floor(Math.random() * COLOR_CHOICES.length)]);
  const [coords, setCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const dayOptions = useMemo(buildDayOptions, []);
  const [dayIndex, setDayIndex] = useState(0);
  const [hour, setHour] = useState(Math.min(new Date().getHours() + 1, 23));
  const [minute, setMinute] = useState(0);

  const [entryFee, setEntryFee] = useState('');
  const [drinksPrice, setDrinksPrice] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');

  // null = not specified — a real third state, not just "no". Tapping the
  // active chip again resets to null instead of forcing a binary answer.
  const [locationIsRented, setLocationIsRented] = useState<boolean | null>(null);
  const [rentalProofAsset, setRentalProofAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);

  // settings.tsx already redirects to /verification before ever linking
  // here, but guard against reaching this screen another way (deep link,
  // back-forward) — hosting requires the same identity verification as
  // joining does, enforced again server-side by the events INSERT policy.
  useEffect(() => {
    if (VERIFICATION_REQUIRED && !user?.verified) {
      router.replace({ pathname: '/verification', params: { returnTo: '/new-event' } });
    }
  }, [user]);

  // Just a starting point, not the only option anymore — the host can move
  // the pin anywhere via LocationPickerModal.
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const last = await Location.getLastKnownPositionAsync();
        if (last) setCoords({ lng: last.coords.longitude, lat: last.coords.latitude });
      } catch {
        // Falls back to the Brașov center default below.
      }
    })();
  }, []);

  function buildStartsAt() {
    const date = dayOptions[dayIndex] ?? new Date();
    const startsAt = new Date(date);
    startsAt.setHours(hour, minute, 0, 0);
    return startsAt;
  }

  async function handlePickRentalProof() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alertPermissionDenied(permission.canAskAgain, 'Activează accesul la poze din Setările telefonului ca să atașezi o dovadă.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (result.canceled || !result.assets[0]) return;

    light();
    setRentalProofAsset(result.assets[0]);
  }

  async function handlePublish() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      showAlert('Mai e nevoie de un nume', 'Dă-i evenimentului un titlu înainte să-l publici.');
      return;
    }
    if (!user || publishingRef.current) return;

    // The default hour/minute (now + 1h, capped at 23:00) can land in the
    // past for a "today" event created late at night — e.g. picking 23:45
    // defaults to 23:00 today, already 45 minutes gone by publish time.
    if (buildStartsAt().getTime() < Date.now()) {
      showAlert('Ora aleasă a trecut deja', 'Alege o oră care nu a trecut încă.');
      return;
    }

    const finalCoords = coords ?? { lng: MAPBOX_INITIAL_VIEW.center[0], lat: MAPBOX_INITIAL_VIEW.center[1] };
    const parsedEntryFee = entryFee.trim() ? Number(entryFee.replace(',', '.')) : null;
    const parsedDrinksPrice = drinksPrice.trim() ? Number(drinksPrice.replace(',', '.')) : null;
    const parsedMaxParticipants = maxParticipants.trim() ? Number(maxParticipants) : null;

    // Non-numeric leftovers (stray characters that survive the decimal/
    // number-pad keyboard, or a paste) used to be silently treated as "field
    // left empty" via the NaN-skipping checks below — tell the user instead
    // of quietly discarding what they typed.
    if (parsedEntryFee !== null && Number.isNaN(parsedEntryFee)) {
      showAlert('Preț invalid', 'Introdu un preț valid pentru intrare sau lasă câmpul gol.');
      return;
    }
    if (parsedDrinksPrice !== null && Number.isNaN(parsedDrinksPrice)) {
      showAlert('Preț invalid', 'Introdu un preț valid pentru băuturi sau lasă câmpul gol.');
      return;
    }
    if (parsedMaxParticipants !== null && Number.isNaN(parsedMaxParticipants)) {
      showAlert('Număr invalid', 'Introdu un număr valid de participanți sau lasă câmpul gol.');
      return;
    }

    // The DB rejects a negative entry_fee_ron/drinks_price_ron (see
    // events_entry_fee_non_negative / events_drinks_price_non_negative), but
    // used to only surface that as the generic "couldn't publish" error
    // after a round-trip — catch it here with a specific message instead.
    if (parsedEntryFee !== null && parsedEntryFee < 0) {
      showAlert('Preț invalid', 'Prețul intrării nu poate fi negativ.');
      return;
    }
    if (parsedDrinksPrice !== null && parsedDrinksPrice < 0) {
      showAlert('Preț invalid', 'Prețul băuturilor nu poate fi negativ.');
      return;
    }

    publishingRef.current = true;
    setPublishing(true);

    try {
      let rentalProofPath: string | null = null;
      if (locationIsRented && rentalProofAsset) {
        const { extension, contentType } = extensionAndTypeForImage(rentalProofAsset);
        rentalProofPath = await uploadRentalProof(user.id, rentalProofAsset.uri, extension, contentType);
      }

      const created = await createEvent(user.id, {
        title: trimmedTitle,
        detail: detail.trim() || 'Detalii în curând',
        emoji,
        color,
        lng: finalCoords.lng,
        lat: finalCoords.lat,
        genre: genre.trim() || 'Surpriză',
        startsAt: buildStartsAt().toISOString(),
        entryFeeRon: parsedEntryFee !== null && !Number.isNaN(parsedEntryFee) ? parsedEntryFee : null,
        drinksPriceRon: parsedDrinksPrice !== null && !Number.isNaN(parsedDrinksPrice) ? parsedDrinksPrice : null,
        maxParticipants:
          parsedMaxParticipants !== null && !Number.isNaN(parsedMaxParticipants) && parsedMaxParticipants > 0
            ? Math.floor(parsedMaxParticipants)
            : null,
        locationIsRented,
        rentalProofPath,
      });

      if (!created) {
        // The upload succeeded even though the event insert didn't —
        // clean it up rather than leaving an orphaned file, same as
        // sendMediaMessage does for message media.
        if (rentalProofPath) removeRentalProof(rentalProofPath).catch(() => {});
        showAlert('A apărut o eroare', 'Nu am putut publica evenimentul. Încearcă din nou.');
        return;
      }

      medium();
      addEvent(created);
      router.replace({ pathname: '/event/[id]', params: { id: created.id } });
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
  }

  const mapPreviewUrl = coords ? buildApproxStaticMapUrl(coords.lng, coords.lat, scheme, 640, 160) : null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />

      <View style={styles.topBar}>
        <AnimatedPressable
          onPress={() => {
            light();
            router.back();
          }}
          hitSlop={10}
          accessibilityLabel="Înapoi"
          style={[styles.backButton, shadows.soft, { borderColor: glassButton.border }]}
        >
          <GlassSurface />
          <Ionicons name="chevron-back" size={20} color={glassButton.icon} />
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Eveniment nou</Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={Platform.OS === 'ios' ? 20 : 0}
        keyboardOpeningTime={0}
      >
        <Text style={[styles.label, { color: theme.textSecondary }]}>TITLU</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Ex: Grătar la iarbă verde"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]}
          maxLength={TITLE_MAX_LENGTH}
        />
        <Text style={[styles.counter, { color: theme.textSecondary }]}>
          {title.length}/{TITLE_MAX_LENGTH}
        </Text>

        <Text style={[styles.label, { color: theme.textSecondary }]}>DESCRIERE</Text>
        <TextInput
          value={detail}
          onChangeText={setDetail}
          placeholder="Spune-le prietenilor ce să aștepte"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]}
          maxLength={DETAIL_MAX_LENGTH}
        />
        <Text style={[styles.counter, { color: theme.textSecondary }]}>
          {detail.length}/{DETAIL_MAX_LENGTH}
        </Text>

        <Text style={[styles.label, { color: theme.textSecondary }]}>LOCAȚIE</Text>
        <AnimatedPressable
          onPress={() => {
            light();
            setPickerOpen(true);
          }}
          style={[styles.locationCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          {mapPreviewUrl ? (
            <Image source={{ uri: mapPreviewUrl }} style={styles.locationPreview} resizeMode="cover" />
          ) : (
            <View style={[styles.locationPreview, styles.locationPreviewEmpty, { backgroundColor: theme.surfaceMuted }]} />
          )}
          <View style={styles.locationCardFooter}>
            <Ionicons name="location" size={16} color={colors.green500} />
            <Text style={[styles.locationCardText, { color: theme.textPrimary }]}>
              {coords ? 'Schimbă locația' : 'Alege locația pe hartă'}
            </Text>
          </View>
        </AnimatedPressable>

        <Text style={[styles.label, { color: theme.textSecondary }]}>DATĂ</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {dayOptions.map((date, index) => (
            <AnimatedPressable
              key={date.toDateString()}
              onPress={() => {
                light();
                setDayIndex(index);
              }}
              style={[
                styles.chip,
                { backgroundColor: theme.surface, borderColor: index === dayIndex ? colors.green500 : theme.border },
                index === dayIndex && styles.chipActive,
              ]}
            >
              <Text style={[styles.chipText, { color: index === dayIndex ? colors.green500 : theme.textPrimary }]}>
                {dayLabel(date, index)}
              </Text>
            </AnimatedPressable>
          ))}
        </ScrollView>

        <Text style={[styles.label, { color: theme.textSecondary }]}>ORĂ</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {HOURS.map((h) => (
            <AnimatedPressable
              key={h}
              onPress={() => {
                light();
                setHour(h);
              }}
              style={[
                styles.chipSmall,
                { backgroundColor: theme.surface, borderColor: h === hour ? colors.green500 : theme.border },
                h === hour && styles.chipActive,
              ]}
            >
              <Text style={[styles.chipText, { color: h === hour ? colors.green500 : theme.textPrimary }]}>
                {String(h).padStart(2, '0')}
              </Text>
            </AnimatedPressable>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {MINUTES.map((m) => (
            <AnimatedPressable
              key={m}
              onPress={() => {
                light();
                setMinute(m);
              }}
              style={[
                styles.chipSmall,
                { backgroundColor: theme.surface, borderColor: m === minute ? colors.green500 : theme.border },
                m === minute && styles.chipActive,
              ]}
            >
              <Text style={[styles.chipText, { color: m === minute ? colors.green500 : theme.textPrimary }]}>
                :{String(m).padStart(2, '0')}
              </Text>
            </AnimatedPressable>
          ))}
        </ScrollView>

        <Text style={[styles.label, { color: theme.textSecondary }]}>MUZICĂ / GEN</Text>
        <TextInput
          value={genre}
          onChangeText={setGenre}
          placeholder="Ex: Manele & trap"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]}
          maxLength={GENRE_MAX_LENGTH}
        />
        <Text style={[styles.counter, { color: theme.textSecondary }]}>
          {genre.length}/{GENRE_MAX_LENGTH}
        </Text>

        <Text style={[styles.label, { color: theme.textSecondary }]}>PREȚ INTRARE (RON)</Text>
        <TextInput
          value={entryFee}
          onChangeText={setEntryFee}
          placeholder="Lasă gol dacă e gratis"
          placeholderTextColor={theme.textSecondary}
          keyboardType="decimal-pad"
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]}
        />

        <Text style={[styles.label, { color: theme.textSecondary }]}>PREȚ BĂUTURI (RON)</Text>
        <TextInput
          value={drinksPrice}
          onChangeText={setDrinksPrice}
          placeholder="Ex: 15"
          placeholderTextColor={theme.textSecondary}
          keyboardType="decimal-pad"
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]}
        />

        <Text style={[styles.label, { color: theme.textSecondary }]}>MAX PARTICIPANȚI</Text>
        <TextInput
          value={maxParticipants}
          onChangeText={setMaxParticipants}
          placeholder="Lasă gol pentru nelimitat"
          placeholderTextColor={theme.textSecondary}
          keyboardType="number-pad"
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]}
        />

        <Text style={[styles.label, { color: theme.textSecondary }]}>LOCAȚIA E ÎNCHIRIATĂ?</Text>
        <View style={styles.rentedRow}>
          {[
            { label: 'Da', value: true },
            { label: 'Nu', value: false },
          ].map((option) => (
            <AnimatedPressable
              key={option.label}
              onPress={() => {
                light();
                setLocationIsRented((current) => (current === option.value ? null : option.value));
                if (option.value !== true) setRentalProofAsset(null);
              }}
              style={[
                styles.rentedChip,
                { backgroundColor: theme.surface, borderColor: locationIsRented === option.value ? colors.green500 : theme.border },
                locationIsRented === option.value && styles.chipActive,
              ]}
            >
              <Text style={[styles.chipText, { color: locationIsRented === option.value ? colors.green500 : theme.textPrimary }]}>
                {option.label}
              </Text>
            </AnimatedPressable>
          ))}
        </View>

        {locationIsRented === true && (
          <>
            <View style={styles.rentalProofWrap}>
              <AnimatedPressable
                onPress={handlePickRentalProof}
                style={[styles.rentalProofCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                {rentalProofAsset ? (
                  <Image source={{ uri: rentalProofAsset.uri }} style={styles.rentalProofPreview} resizeMode="cover" />
                ) : (
                  <Ionicons name="camera-outline" size={20} color={theme.accent} />
                )}
                <Text style={[styles.rentalProofText, { color: theme.textPrimary }]}>
                  {rentalProofAsset ? 'Schimbă dovada' : 'Atașează dovada (opțional)'}
                </Text>
              </AnimatedPressable>
              {rentalProofAsset && (
                <AnimatedPressable
                  onPress={() => {
                    light();
                    setRentalProofAsset(null);
                  }}
                  hitSlop={10}
                  accessibilityLabel="Elimină dovada"
                  style={[styles.rentalProofClear, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                >
                  <Ionicons name="close" size={13} color={theme.textSecondary} />
                </AnimatedPressable>
              )}
            </View>
            <Text style={[styles.rentalProofHint, { color: theme.textSecondary }]}>
              Rămâne privată — doar tu o vezi, nu apare public pe eveniment.
            </Text>
          </>
        )}

        <Text style={[styles.label, { color: theme.textSecondary }]}>ICONIȚĂ</Text>
        <View style={styles.emojiRow}>
          {EMOJI_CHOICES.map((choice) => (
            <AnimatedPressable
              key={choice}
              onPress={() => {
                light();
                setEmoji(choice);
              }}
              style={[
                styles.emojiChip,
                { backgroundColor: theme.surface, borderColor: choice === emoji ? colors.green500 : theme.border },
                choice === emoji && styles.emojiChipActive,
              ]}
            >
              <Text style={styles.emojiChipText}>{choice}</Text>
            </AnimatedPressable>
          ))}
        </View>

        <Text style={[styles.label, { color: theme.textSecondary }]}>CULOARE</Text>
        <View style={styles.emojiRow}>
          {COLOR_CHOICES.map((choice) => (
            <AnimatedPressable
              key={choice}
              onPress={() => {
                light();
                setColor(choice);
              }}
              style={[
                styles.colorChip,
                { backgroundColor: choice },
                choice === color && styles.colorChipActive,
              ]}
            />
          ))}
        </View>

        <AnimatedPressable
          onPress={handlePublish}
          style={[styles.publishButton, shadows.glowGreen, publishing && styles.publishButtonDisabled]}
        >
          <Text style={styles.publishText}>{publishing ? 'Se publică...' : 'Publică evenimentul'}</Text>
        </AnimatedPressable>
      </KeyboardAwareScrollView>

      <LocationPickerModal
        visible={pickerOpen}
        initialCoords={coords}
        onClose={() => setPickerOpen(false)}
        onConfirm={(picked) => {
          setCoords(picked);
          setPickerOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 60, gap: 6 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginTop: 14, marginBottom: 6 },
  counter: { fontSize: 10, textAlign: 'right' },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  locationCard: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  locationPreview: { width: '100%', height: 110 },
  locationPreviewEmpty: {},
  locationCardFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10 },
  locationCardText: { fontSize: 13, fontWeight: '700' },
  chipScroll: { marginBottom: 4 },
  rentedRow: { flexDirection: 'row', gap: 10 },
  rentedChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 13, borderWidth: 2 },
  rentalProofWrap: { position: 'relative', alignSelf: 'flex-start', marginTop: 10 },
  rentalProofCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rentalProofClear: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rentalProofPreview: { width: 34, height: 34, borderRadius: 8 },
  rentalProofText: { fontSize: 13, fontWeight: '700' },
  rentalProofHint: { fontSize: 11, fontStyle: 'italic', marginTop: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 13, borderWidth: 2, marginRight: 8 },
  chipSmall: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 11, borderWidth: 2, marginRight: 6 },
  chipActive: { transform: [{ scale: 1.03 }] },
  chipText: { fontSize: 13, fontWeight: '700' },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emojiChip: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiChipActive: { transform: [{ scale: 1.05 }] },
  emojiChipText: { fontSize: 22 },
  colorChip: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: 'transparent' },
  colorChipActive: { borderColor: colors.white, transform: [{ scale: 1.1 }] },
  publishButton: {
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
  },
  publishButtonDisabled: { opacity: 0.7 },
  publishText: { color: colors.white, fontSize: 17, fontWeight: '900' },
});
