import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildApproxStaticMapUrl } from '@/constants/mapbox';
import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUser } from '@/contexts/UserContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Avatar } from '@/components/common/Avatar';
import { GlassSurface } from '@/components/common/GlassSurface';
import { getEventPreviewDraft, type EventPreviewDraft } from '@/lib/eventPreview';
import { formatDrinkVolume } from '@/lib/drinks';
import { MusicCoverPlaceholder } from '@/components/music/MusicCoverPlaceholder';
import type { Translations } from '@/lib/i18n/ro';

function formatDate(iso: string | null, locale: string) {
  if (!iso) return null;
  const date = new Date(iso);
  return `${date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })} · ${date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
}

function formatPrice(value: number | null, t: Translations) {
  if (value === null) return null;
  return value === 0 ? t.event.free : `${value} RON`;
}

export default function EventPreview() {
  const { colors: theme, scheme } = useAppTheme();
  const { user } = useUser();
  const { light } = useHaptics();
  const { t, locale } = useLanguage();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<EventPreviewDraft | null>(null);

  useEffect(() => {
    setDraft(getEventPreviewDraft());
  }, []);

  if (!draft) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t.eventPreview.unavailable}</Text>
        <AnimatedPressable onPress={() => router.back()} style={styles.centerBack}><Text style={[styles.backText, { color: theme.accent }]}>{t.common.back}</Text></AnimatedPressable>
      </SafeAreaView>
    );
  }

  const mapUrl = draft.lng !== null && draft.lat !== null ? buildApproxStaticMapUrl(draft.lng, draft.lat, scheme, 640, 240) : null;
  const returnToEdit = () => {
    if (draft.mode === 'edit' && draft.eventId) router.replace({ pathname: '/edit-event/[id]', params: { id: draft.eventId } });
    else router.replace('/new-event');
  };
  const publish = () => {
    if (draft.mode === 'edit' && draft.eventId) {
      router.replace({ pathname: '/edit-event/[id]', params: { id: draft.eventId, publish: '1' } });
    } else {
      router.replace({ pathname: '/new-event', params: { publish: '1' } });
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}> 
      <StatusBar style={theme.statusBar} />
      <View style={styles.topBar}>
        <AnimatedPressable onPress={returnToEdit} hitSlop={10} style={[styles.backButton, shadows.soft, { borderColor: glassButton.border }]}> 
          <GlassSurface />
          <Ionicons name="chevron-back" size={20} color={glassButton.icon} />
        </AnimatedPressable>
        <Text style={[styles.topTitle, { color: theme.textPrimary }]}>{t.eventPreview.topTitle}</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 150 }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: draft.color }]}> <Text style={styles.heroEmoji}>{draft.emoji}</Text></View>
        <Text style={[styles.title, { color: theme.textPrimary }]}>{draft.title || t.editEvent.titlePlaceholder}</Text>
        {draft.genre ? <Text style={[styles.genre, { color: theme.accent }]}>{draft.genre}</Text> : null}
        {formatDate(draft.startsAt, locale) && <Text style={[styles.date, { color: theme.textSecondary }]}>{formatDate(draft.startsAt, locale)}</Text>}

        {user && (
          <View style={[styles.organizerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Avatar uri={user.avatarUrl} name={user.name} size={44} fontSize={17} />
            <View style={styles.organizerCopy}><Text style={[styles.label, { color: theme.textSecondary }]}>{t.event.organizer}</Text><Text style={[styles.organizerName, { color: theme.textPrimary }]}>{user.name}</Text><Text style={[styles.username, { color: theme.textSecondary }]}>@{user.username}</Text></View>
            {user.verified && <Ionicons name="checkmark-circle" size={18} color={theme.accent} />}
          </View>
        )}

        {(draft.entryFeeRon !== null || draft.drinksPriceRon !== null || draft.maxParticipants !== null || draft.locationIsRented === true) && (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {draft.entryFeeRon !== null && <InfoRow icon="ticket-outline" text={t.event.entry(formatPrice(draft.entryFeeRon, t)!)} theme={theme} />}
            {draft.drinksPriceRon !== null && <InfoRow icon="wine-outline" text={t.event.drinksFrom(formatPrice(draft.drinksPriceRon, t)!)} theme={theme} />}
            {draft.maxParticipants !== null && <InfoRow icon="people-outline" text={t.event.maxPeople(draft.maxParticipants)} theme={theme} />}
            {draft.locationIsRented === true && <InfoRow icon="key-outline" text={t.eventPreview.rentedLocation(!!draft.rentalProofAttached)} theme={theme} />}
          </View>
        )}

        {draft.detail && <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>{t.newEvent.descriptionLabel}</Text><Text style={[styles.detail, { color: theme.textPrimary }]}>{draft.detail}</Text></View>}
        {draft.drinks?.length > 0 && <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>{t.event.drinks}</Text>{draft.drinks.map((drink) => <View key={drink.id} style={styles.drinkRow}><View style={styles.drinkCopy}><Text style={[styles.drinkName, { color: theme.textPrimary }]}>{drink.name}</Text><Text style={[styles.drinkMeta, { color: theme.textSecondary }]}>{formatDrinkVolume(drink.volumeMl)}</Text></View><Text style={[styles.drinkQuantity, { color: theme.accent }]}>× {drink.quantity}</Text></View>)}</View>}
        {draft.songs?.length > 0 && <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>{t.eventPreview.musicLabel}</Text>{draft.genre ? <Text style={[styles.genreValue, { color: theme.textPrimary }]}>{draft.genre}</Text> : null}<Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>{t.event.playlist}</Text>{draft.songs.slice(0, 4).map((song) => <View key={song.id} style={styles.songRow}>{song.coverUrl ? <Image source={{ uri: song.coverUrl }} style={styles.songCover} /> : <MusicCoverPlaceholder size={38} />}<View style={styles.drinkCopy}><Text style={[styles.drinkName, { color: theme.textPrimary }]} numberOfLines={1}>{song.title}</Text><Text style={[styles.drinkMeta, { color: theme.textSecondary }]} numberOfLines={1}>{song.artist}</Text></View></View>)}{draft.songs.length > 4 && <Text style={[styles.moreSongs, { color: theme.accent }]}>{t.event.moreSongs(draft.songs.length - 4)}</Text>}</View>}
        {mapUrl && <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>{t.newEvent.locationLabel}</Text><Image source={{ uri: mapUrl }} style={styles.map} resizeMode="cover" /></View>}

        <View style={[styles.previewNote, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
          <Ionicons name="eye-outline" size={18} color={theme.accent} />
          <Text style={[styles.noteText, { color: theme.textSecondary }]}>{t.eventPreview.previewNote}</Text>
        </View>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 14, backgroundColor: theme.page }]}>
        <AnimatedPressable onPress={returnToEdit} style={[styles.editButton, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <Text style={[styles.editText, { color: theme.textPrimary }]}>{t.profile.edit}</Text>
        </AnimatedPressable>
        <AnimatedPressable onPress={publish} style={[styles.publishButton, shadows.glowGreen]}>
          <Text style={styles.publishText}>{t.eventPreview.publishEvent}</Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

function InfoRow({ icon, text, theme }: { icon: keyof typeof Ionicons.glyphMap; text: string; theme: ReturnType<typeof useAppTheme>['colors'] }) {
  return <View style={styles.infoRow}><Ionicons name={icon} size={16} color={colors.green500} /><Text style={[styles.infoText, { color: theme.textPrimary }]}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 18, fontWeight: '800' },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  hero: { alignSelf: 'center', width: 94, height: 94, borderRadius: 47, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  heroEmoji: { fontSize: 44 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '900', textAlign: 'center', marginTop: 2 },
  genre: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  genreValue: { fontSize: 13, fontWeight: '800', marginTop: -4 },
  date: { fontSize: 13, textAlign: 'center', textTransform: 'capitalize' },
  organizerCard: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderRadius: 16, padding: 12 },
  organizerCopy: { flex: 1, minWidth: 0 },
  label: { fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  organizerName: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  username: { fontSize: 11, marginTop: 1 },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 9 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  infoText: { fontSize: 13, fontWeight: '700', flex: 1 },
  detail: { fontSize: 14, lineHeight: 21 },
  drinkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  drinkCopy: { flex: 1, minWidth: 0 },
  drinkName: { fontSize: 13, fontWeight: '800' },
  drinkMeta: { fontSize: 11, marginTop: 2 },
  drinkQuantity: { fontSize: 13, fontWeight: '900' },
  songRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  songCover: { width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  moreSongs: { fontSize: 11, fontWeight: '800', marginTop: 2 },
  map: { width: '100%', height: 150, borderRadius: 14 },
  previewNote: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 14, padding: 12 },
  noteText: { flex: 1, fontSize: 11, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.14)' },
  editButton: { flex: 1, minHeight: 50, borderWidth: 1, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  editText: { fontSize: 13, fontWeight: '800' },
  publishButton: { flex: 1.4, minHeight: 50, borderRadius: 15, backgroundColor: colors.green500, alignItems: 'center', justifyContent: 'center' },
  publishText: { color: colors.white, fontSize: 13, fontWeight: '900', textAlign: 'center' },
  emptyText: { textAlign: 'center', padding: spacing.xl, fontSize: 14 },
  centerBack: { alignSelf: 'center', padding: spacing.md },
  backText: { fontSize: 13, fontWeight: '800' },
});
