import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { MAPBOX_INITIAL_VIEW, buildApproxStaticMapUrl } from '@/constants/mapbox';
import { SpritzEvent } from '@/constants/events';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useEvents } from '@/contexts/EventsContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { WheelPicker } from '@/components/common/WheelPicker';
import { GlassSurface } from '@/components/common/GlassSurface';
import { LocationPickerModal } from '@/components/event/LocationPickerModal';
import { addMonths, isDateBetween, isSameDay, startOfDay } from '@/lib/calendar';
import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { extensionAndTypeForImage } from '@/lib/media';
import { alertPermissionDenied } from '@/lib/permissions';
import { removeRentalProof, updateEvent, uploadRentalProof } from '@/lib/events';

const TITLE_MAX_LENGTH = 60;
const DETAIL_MAX_LENGTH = 200;
const EMOJI_CHOICES = ['🎉', '🍻', '🎷', '🎸', '🌮', '🎲', '🥾', '🧺', '⛰️', '🍹'];
const COLOR_CHOICES = ['#FF9F5A', '#5FD98A', '#5AA9E6', '#FFD25A', '#FF6B81', '#B388FF', '#4ED9C9'];
const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES = [0, 15, 30, 45];
const MONTHS = ['IANUARIE', 'FEBRUARIE', 'MARTIE', 'APRILIE', 'MAI', 'IUNIE', 'IULIE', 'AUGUST', 'SEPTEMBRIE', 'OCTOMBRIE', 'NOIEMBRIE', 'DECEMBRIE'];

function initialDate(event: SpritzEvent) {
  return event.startsAt ? new Date(event.startsAt) : startOfDay(new Date());
}

export default function EditEvent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { events, loading: eventsLoading, error: eventsError, refresh, updateEvent: updateEventInContext } = useEvents();
  const { user } = useUser();
  const { colors: theme, scheme } = useAppTheme();
  const { light, medium } = useHaptics();
  const event = useMemo(() => events.find((item) => item.id === id), [events, id]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rentalProofAsset, setRentalProofAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [proofRemoved, setProofRemoved] = useState(false);
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [genre, setGenre] = useState('');
  const [emoji, setEmoji] = useState(EMOJI_CHOICES[0]);
  const [color, setColor] = useState(COLOR_CHOICES[0]);
  const [coords, setCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [locationIsRented, setLocationIsRented] = useState<boolean | null>(null);
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(0);
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [dateEdited, setDateEdited] = useState(false);
  const [entryFee, setEntryFee] = useState('');
  const [drinksPrice, setDrinksPrice] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');

  useEffect(() => {
    if (!event) return;
    const date = initialDate(event);
    setTitle(event.title);
    setDetail(event.detail);
    setGenre(event.genre);
    setEmoji(event.emoji);
    setColor(event.color);
    setCoords({ lng: event.lng, lat: event.lat });
    setLocationIsRented(event.locationIsRented);
    setHour(date.getHours());
    setMinute(date.getMinutes());
    setSelectedDate(startOfDay(date));
    setDateEdited(false);
    setEntryFee(event.entryFeeRon === null ? '' : String(event.entryFeeRon));
    setDrinksPrice(event.drinksPriceRon === null ? '' : String(event.drinksPriceRon));
    setMaxParticipants(event.maxParticipants === null ? '' : String(event.maxParticipants));
  }, [event]);

  useEffect(() => {
    if (!user || !event) return;
    if (event.hostId !== user.id) {
      Alert.alert('Acces restricționat', 'Doar organizatorul poate edita acest eveniment.', [
        { text: 'Înapoi', onPress: () => router.back() },
      ]);
    }
  }, [event, user]);

  if (eventsLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
        <Text style={[styles.message, { color: theme.textSecondary }]}>Se încarcă evenimentul...</Text>
      </SafeAreaView>
    );
  }

  if (eventsError && !event) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
        <Text style={[styles.message, { color: theme.textSecondary }]}>Nu am putut încărca evenimentul.</Text>
        <AnimatedPressable onPress={() => void refresh()} style={[styles.retryButton, { borderColor: theme.border }]}>
          <Text style={[styles.retryText, { color: theme.textPrimary }]}>Reîncearcă</Text>
        </AnimatedPressable>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
        <Text style={[styles.message, { color: theme.textSecondary }]}>Evenimentul nu mai este disponibil.</Text>
      </SafeAreaView>
    );
  }
  const currentEvent = event;

  const isOwner = !!user && currentEvent.hostId === user.id;
  const originalStart = currentEvent.startsAt ? new Date(currentEvent.startsAt) : null;
  const today = startOfDay(new Date());
  const latestDate = addMonths(today, 1);
  const mapPreviewUrl = coords ? buildApproxStaticMapUrl(coords.lng, coords.lat, scheme, 640, 160) : null;
  const isSelectableDate = (date: Date) => isDateBetween(date, today, latestDate) || (!!originalStart && isSameDay(date, originalStart));
  const dateDays = Array.from({ length: 31 }, (_, index) => {
    const value = index + 1;
    const candidate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), value);
    return { label: String(value).padStart(2, '0'), value, disabled: candidate.getDate() !== value || !isSelectableDate(candidate) };
  });
  const monthKeys = new Set<number>();
  const firstMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonth = new Date(latestDate.getFullYear(), latestDate.getMonth(), 1);
  const monthCount = (lastMonth.getFullYear() - firstMonth.getFullYear()) * 12 + lastMonth.getMonth() - firstMonth.getMonth() + 1;
  for (let index = 0; index < monthCount; index += 1) {
    const date = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + index, 1);
    monthKeys.add(date.getFullYear() * 12 + date.getMonth());
  }
  if (originalStart) monthKeys.add(originalStart.getFullYear() * 12 + originalStart.getMonth());
  const dateMonths = Array.from(monthKeys)
    .sort((a, b) => a - b)
    .map((value) => {
      const year = Math.floor(value / 12);
      const month = value % 12;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      return {
        label: MONTHS[month],
        value,
        disabled: !Array.from({ length: daysInMonth }, (_, index) => isSelectableDate(new Date(year, month, index + 1))).some(Boolean),
      };
    });

  function selectDatePart(part: 'day' | 'month', value: number) {
    const year = part === 'month' ? Math.floor(value / 12) : selectedDate.getFullYear();
    const month = part === 'month' ? value % 12 : selectedDate.getMonth();
    const day = part === 'day' ? value : selectedDate.getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const candidate = new Date(year, month, Math.min(day, daysInMonth));
    if (isSelectableDate(candidate)) {
      setDateEdited(true);
      setSelectedDate(candidate);
    }
  }

  function buildStartsAt() {
    const startsAt = new Date(selectedDate);
    startsAt.setHours(hour, minute, 0, 0);
    return startsAt;
  }

  function dateWasChanged() {
    return originalStart ? !isSameDay(selectedDate, originalStart) : dateEdited;
  }

  function timeWasChanged() {
    return originalStart ? buildStartsAt().getTime() !== originalStart.getTime() : dateEdited;
  }

  async function pickProof() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alertPermissionDenied(permission.canAskAgain, 'Activează accesul la poze din Setările telefonului ca să atașezi o dovadă.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!result.canceled && result.assets[0]) {
      setRentalProofAsset(result.assets[0]);
      setProofRemoved(false);
    }
  }

  async function save() {
    if (!isOwner || !user || savingRef.current) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Mai e nevoie de un nume', 'Dă-i evenimentului un titlu înainte să salvezi.');
      return;
    }
    const hasStart = originalStart !== null || dateEdited;
    if (hasStart && dateWasChanged() && !isDateBetween(selectedDate, today, latestDate)) {
      Alert.alert('Data invalidă', 'Alege o dată între azi și peste o lună.');
      return;
    }
    const startsAt = hasStart ? buildStartsAt() : null;
    if (startsAt && timeWasChanged() && startsAt.getTime() < Date.now()) {
      Alert.alert('Ora aleasă a trecut deja', 'Alege o oră care nu a trecut încă.');
      return;
    }
    const parsedEntryFee = entryFee.trim() ? Number(entryFee.replace(',', '.')) : null;
    const parsedDrinksPrice = drinksPrice.trim() ? Number(drinksPrice.replace(',', '.')) : null;
    const parsedMaxParticipants = maxParticipants.trim() ? Number(maxParticipants) : null;
    if (parsedEntryFee !== null && (!Number.isFinite(parsedEntryFee) || parsedEntryFee < 0)) {
      Alert.alert('Preț invalid', 'Prețul intrării nu poate fi negativ.');
      return;
    }
    if (parsedDrinksPrice !== null && (!Number.isFinite(parsedDrinksPrice) || parsedDrinksPrice < 0)) {
      Alert.alert('Preț invalid', 'Prețul băuturilor nu poate fi negativ.');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    let newProofPath: string | null = null;
    const oldProofPath = currentEvent.rentalProofPath;
    try {
      if (locationIsRented && rentalProofAsset) {
        const { extension, contentType } = extensionAndTypeForImage(rentalProofAsset);
        newProofPath = await uploadRentalProof(user.id, rentalProofAsset.uri, extension, contentType);
        if (!newProofPath) throw new Error('rental-proof-upload-failed');
      }
      const proofPath = locationIsRented === true ? (newProofPath ?? (proofRemoved ? null : oldProofPath)) : null;
      const updated = await updateEvent(currentEvent.id, user.id, {
        title: trimmedTitle,
        detail: detail.trim() || 'Detalii în curând',
        emoji,
        color,
        lng: coords?.lng ?? currentEvent.lng ?? MAPBOX_INITIAL_VIEW.center[0],
        lat: coords?.lat ?? currentEvent.lat ?? MAPBOX_INITIAL_VIEW.center[1],
        genre: genre.trim() || 'Surpriză',
        startsAt: startsAt ? startsAt.toISOString() : null,
        entryFeeRon: parsedEntryFee,
        drinksPriceRon: parsedDrinksPrice,
        maxParticipants: parsedMaxParticipants !== null && Number.isFinite(parsedMaxParticipants) && parsedMaxParticipants > 0
          ? Math.floor(parsedMaxParticipants)
          : null,
        locationIsRented,
        rentalProofPath: proofPath,
      });
      if (!updated) throw new Error('event-update-failed');
      if (oldProofPath && oldProofPath !== proofPath) await removeRentalProof(oldProofPath);
      updateEventInContext(updated);
      medium();
      router.replace({ pathname: '/event/[id]', params: { id: updated.id } });
    } catch (error) {
      if (newProofPath) await removeRentalProof(newProofPath);
      const message = error instanceof Error && error.message === 'rental-proof-upload-failed'
        ? 'Nu am putut încărca dovada nouă. Dovada existentă a fost păstrată.'
        : 'Nu am putut salva modificările. Încearcă din nou.';
      Alert.alert('A apărut o eroare', message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />
      <View style={styles.topBar}>
        <AnimatedPressable onPress={() => router.back()} hitSlop={10} style={[styles.backButton, shadows.soft, { borderColor: glassButton.border }]}>
          <GlassSurface />
          <Ionicons name="chevron-back" size={20} color={glassButton.icon} />
        </AnimatedPressable>
        <Text style={[styles.topTitle, { color: theme.textPrimary }]}>Editează evenimentul</Text>
        <View style={styles.backButton} />
      </View>
      {!isOwner ? (
        <Text style={[styles.message, { color: theme.textSecondary }]}>Doar organizatorul poate edita acest eveniment.</Text>
      ) : (
        <KeyboardAwareScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
          extraScrollHeight={Platform.OS === 'ios' ? 20 : 0}
        >
          <FieldLabel text="TITLU" theme={theme} />
          <TextInput value={title} onChangeText={setTitle} maxLength={TITLE_MAX_LENGTH} placeholder="Titlul evenimentului" placeholderTextColor={theme.textSecondary} style={[styles.input, inputColors(theme)]} />
          <Text style={[styles.counter, { color: theme.textSecondary }]}>{title.length}/{TITLE_MAX_LENGTH}</Text>
          <FieldLabel text="DESCRIERE" theme={theme} />
          <TextInput value={detail} onChangeText={setDetail} maxLength={DETAIL_MAX_LENGTH} placeholder="Descriere" placeholderTextColor={theme.textSecondary} style={[styles.input, inputColors(theme)]} />
          <Text style={[styles.counter, { color: theme.textSecondary }]}>{detail.length}/{DETAIL_MAX_LENGTH}</Text>
          <FieldLabel text="LOCAȚIE" theme={theme} />
          <AnimatedPressable onPress={() => setPickerOpen(true)} style={[styles.locationCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {mapPreviewUrl ? <Image source={{ uri: mapPreviewUrl }} style={styles.locationPreview} /> : <View style={[styles.locationPreview, { backgroundColor: theme.surfaceMuted }]} />}
            <View style={styles.locationFooter}><Ionicons name="location" size={16} color={colors.green500} /><Text style={[styles.locationText, { color: theme.textPrimary }]}>Schimbă locația</Text></View>
          </AnimatedPressable>
          <FieldLabel text="DATĂ" theme={theme} />
          <View style={[styles.wheelGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <WheelPicker label="ZI" options={dateDays} selectedValue={selectedDate.getDate()} onValueChange={(value) => selectDatePart('day', value)} />
            <WheelPicker label="LUNĂ" options={dateMonths} selectedValue={selectedDate.getFullYear() * 12 + selectedDate.getMonth()} onValueChange={(value) => selectDatePart('month', value)} />
            <Text style={[styles.selectedDate, { color: theme.textSecondary }]}>{selectedDate.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          </View>
          <FieldLabel text="ORĂ" theme={theme} />
          <View style={[styles.wheelGroup, styles.timeWheelGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <WheelPicker label="ORE" options={HOURS.map((value) => ({ label: String(value).padStart(2, '0'), value }))} selectedValue={hour} onValueChange={(value) => { setDateEdited(true); setHour(value); }} />
            <Text style={[styles.timeSeparator, { color: theme.textPrimary }]}>:</Text>
            <WheelPicker label="MINUTE" options={MINUTES.map((value) => ({ label: String(value).padStart(2, '0'), value }))} selectedValue={minute} onValueChange={(value) => { setDateEdited(true); setMinute(value); }} />
          </View>
          <FieldLabel text="MUZICĂ / GEN" theme={theme} />
          <TextInput value={genre} onChangeText={setGenre} placeholder="Genul muzical" placeholderTextColor={theme.textSecondary} style={[styles.input, inputColors(theme)]} />
          <FieldLabel text="PREȚ INTRARE (RON)" theme={theme} />
          <TextInput value={entryFee} onChangeText={setEntryFee} keyboardType="decimal-pad" placeholder="Ex: 20" placeholderTextColor={theme.textSecondary} style={[styles.input, inputColors(theme)]} />
          <FieldLabel text="PREȚ BĂUTURI (RON)" theme={theme} />
          <TextInput value={drinksPrice} onChangeText={setDrinksPrice} keyboardType="decimal-pad" placeholder="Ex: 15" placeholderTextColor={theme.textSecondary} style={[styles.input, inputColors(theme)]} />
          <FieldLabel text="MAX PARTICIPANȚI" theme={theme} />
          <TextInput value={maxParticipants} onChangeText={setMaxParticipants} keyboardType="number-pad" placeholder="Lasă gol pentru nelimitat" placeholderTextColor={theme.textSecondary} style={[styles.input, inputColors(theme)]} />
          <FieldLabel text="LOCAȚIA E ÎNCHIRIATĂ?" theme={theme} />
          <View style={styles.rentedRow}>{[{ label: 'Da', value: true }, { label: 'Nu', value: false }].map((option) => <AnimatedPressable key={option.label} onPress={() => { setLocationIsRented((current) => current === option.value ? null : option.value); if (option.value !== true) { setRentalProofAsset(null); setProofRemoved(true); } }} style={[styles.rentedChip, { backgroundColor: theme.surface, borderColor: locationIsRented === option.value ? colors.green500 : theme.border }]}><Text style={[styles.chipText, { color: locationIsRented === option.value ? colors.green500 : theme.textPrimary }]}>{option.label}</Text></AnimatedPressable>)}</View>
          {locationIsRented === true && <AnimatedPressable onPress={pickProof} style={[styles.proofCard, { backgroundColor: theme.surface, borderColor: theme.border }]}><Ionicons name="camera-outline" size={20} color={theme.accent} /><Text style={[styles.proofText, { color: theme.textPrimary }]}>{rentalProofAsset ? 'Schimbă dovada' : proofRemoved || !currentEvent.rentalProofPath ? 'Atașează dovada (opțional)' : 'Dovada existentă · schimbă'}</Text></AnimatedPressable>}
          <FieldLabel text="ICONIȚĂ" theme={theme} />
          <View style={styles.emojiRow}>{EMOJI_CHOICES.map((choice) => <AnimatedPressable key={choice} onPress={() => setEmoji(choice)} style={[styles.emojiChip, { borderColor: choice === emoji ? colors.green500 : theme.border }]}><Text style={styles.emoji}>{choice}</Text></AnimatedPressable>)}</View>
          <FieldLabel text="CULOARE" theme={theme} />
          <View style={styles.emojiRow}>{COLOR_CHOICES.map((choice) => <AnimatedPressable key={choice} onPress={() => setColor(choice)} style={[styles.colorChip, { backgroundColor: choice }, choice === color && styles.colorActive]} />)}</View>
          <AnimatedPressable onPress={save} disabled={saving} style={[styles.saveButton, shadows.glowGreen, saving && { opacity: 0.6 }]}><Text style={styles.saveText}>{saving ? 'Se salvează...' : 'Salvează modificările'}</Text></AnimatedPressable>
        </KeyboardAwareScrollView>
      )}
      <LocationPickerModal visible={pickerOpen} initialCoords={coords} onClose={() => setPickerOpen(false)} onConfirm={(picked) => { setCoords(picked); setPickerOpen(false); }} />
    </SafeAreaView>
  );
}

function FieldLabel({ text, theme }: { text: string; theme: ReturnType<typeof useAppTheme>['colors'] }) {
  return <Text style={[styles.label, { color: theme.textSecondary }]}>{text}</Text>;
}

function inputColors(theme: ReturnType<typeof useAppTheme>['colors']) {
  return { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary };
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 18, fontWeight: '800' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 60, gap: 6 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginTop: 14, marginBottom: 6 },
  counter: { fontSize: 10, textAlign: 'right' },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  locationCard: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  locationPreview: { width: '100%', height: 110 },
  locationFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 11 },
  locationText: { fontSize: 13, fontWeight: '700' },
  wheelGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 16, padding: 10 },
  timeWheelGroup: { justifyContent: 'center' },
  timeSeparator: { fontSize: 24, fontWeight: '900', marginTop: 12 },
  selectedDate: { textAlign: 'center', fontSize: 12, fontWeight: '700', marginTop: 8, textTransform: 'capitalize' },
  chipText: { fontSize: 13, fontWeight: '700' },
  rentedRow: { flexDirection: 'row', gap: 10 },
  rentedChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 13, borderWidth: 2 },
  proofCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 13, marginTop: 10 },
  proofText: { fontSize: 13, fontWeight: '700' },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emojiChip: { width: 48, height: 48, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22 },
  colorChip: { width: 40, height: 40, borderRadius: 20 },
  colorActive: { borderWidth: 4, borderColor: colors.white },
  saveButton: { alignItems: 'center', justifyContent: 'center', height: 56, borderRadius: 28, backgroundColor: colors.green500, marginTop: 24 },
  saveText: { color: colors.white, fontSize: 16, fontWeight: '900' },
  message: { textAlign: 'center', padding: spacing.xl, fontSize: 15 },
  retryButton: { alignSelf: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { fontSize: 13, fontWeight: '800' },
});
