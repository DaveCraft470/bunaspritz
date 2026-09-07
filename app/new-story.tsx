import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUser } from '@/contexts/UserContext';
import { useEvents } from '@/contexts/EventsContext';
import { useStories } from '@/contexts/StoriesContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { GlassSurface } from '@/components/common/GlassSurface';
import { extensionAndTypeForImage } from '@/lib/media';
import { getRecentAttendedEventIds } from '@/lib/events';
import type { StoryVisibility } from '@/lib/stories';

// Narrowed to the user's last 2-3 attended (checked-in) events rather than
// any event, so linking a story to an event actually means "I was there".
const RECENT_ATTENDED_EVENTS_LIMIT = 3;

export default function NewStory() {
  const { colors: theme } = useAppTheme();
  const { light, medium } = useHaptics();
  const { t } = useLanguage();
  const { user } = useUser();
  const { events } = useEvents();
  const { create } = useStories();
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState<StoryVisibility>('public');
  const [eventId, setEventId] = useState<string | undefined>();
  const [posting, setPosting] = useState(false);
  const [recentEventIds, setRecentEventIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    getRecentAttendedEventIds(user.id, RECENT_ATTENDED_EVENTS_LIMIT).then(setRecentEventIds);
  }, [user]);

  const recentEvents = recentEventIds
    .map((id) => events.find((event) => event.id === id))
    .filter((event): event is (typeof events)[number] => !!event);

  async function pickMedia() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t.newStory.permissionRequiredTitle, t.newStory.permissionRequiredMessage);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled && result.assets[0]) {
      light();
      setAsset(result.assets[0]);
    }
  }

  async function post() {
    if (!user || !asset || posting) return;
    const selectedEvent = eventId ? events.find((event) => event.id === eventId) : undefined;
    if (eventId && !selectedEvent) {
      Alert.alert(t.newStory.unavailableEventTitle, t.newStory.unavailableEventMessage);
      return;
    }
    setPosting(true);
    const { extension, contentType } = extensionAndTypeForImage(asset);
    const story = await create({
      userId: user.id,
      localUri: asset.uri,
      extension,
      contentType,
      text,
      visibility,
      eventId: selectedEvent?.id,
    });
    setPosting(false);
    if (!story) {
      Alert.alert(t.newStory.couldNotPublishTitle, t.newStory.couldNotPublishMessage);
      return;
    }
    medium();
    router.back();
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}> 
      <StatusBar style={theme.statusBar} />
      <View style={styles.topBar}>
        <AnimatedPressable onPress={() => router.back()} hitSlop={10} style={[styles.backButton, shadows.soft, { borderColor: glassButton.border }]}> 
          <GlassSurface />
          <Ionicons name="chevron-back" size={20} color={glassButton.icon} />
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.textPrimary }]}>{t.newStory.title}</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <AnimatedPressable onPress={pickMedia} style={[styles.mediaCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {asset ? <Image source={{ uri: asset.uri }} style={styles.preview} resizeMode="cover" /> : (
            <View style={styles.mediaEmpty}>
              <Ionicons name="image-outline" size={34} color={theme.accent} />
              <Text style={[styles.mediaTitle, { color: theme.textPrimary }]}>{t.newStory.chooseImage}</Text>
              <Text style={[styles.mediaHint, { color: theme.textSecondary }]}>{t.newStory.imageStoredLocallyHint}</Text>
            </View>
          )}
        </AnimatedPressable>

        <Text style={[styles.label, { color: theme.textSecondary }]}>{t.newStory.optionalTextLabel}</Text>
        <TextInput value={text} onChangeText={setText} maxLength={180} multiline placeholder={t.newStory.textPlaceholder} placeholderTextColor={theme.textSecondary} style={[styles.textInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]} />

        <Text style={[styles.label, { color: theme.textSecondary }]}>{t.newStory.visibilityLabel}</Text>
        <View style={styles.visibilityRow}>
          {([
            ['public', t.newStory.visibilityPublic],
            ['friends', t.newStory.visibilityFriends],
          ] as const).map(([value, label]) => (
            <AnimatedPressable key={value} onPress={() => setVisibility(value)} style={[styles.visibilityButton, { backgroundColor: visibility === value ? colors.green500 : theme.surface, borderColor: visibility === value ? colors.green500 : theme.border }]}>
              <Text style={[styles.visibilityText, { color: visibility === value ? colors.white : theme.textPrimary }]}>{label}</Text>
            </AnimatedPressable>
          ))}
        </View>

        <Text style={[styles.label, { color: theme.textSecondary }]}>{t.newStory.linkEventLabel}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventsRow}>
          <AnimatedPressable onPress={() => setEventId(undefined)} style={[styles.eventChip, { borderColor: !eventId ? colors.green500 : theme.border, backgroundColor: !eventId ? theme.surfaceMuted : theme.surface }]}>
            <Text style={[styles.eventChipText, { color: theme.textPrimary }]}>{t.newStory.noAssociation}</Text>
          </AnimatedPressable>
          {recentEvents.map((event) => (
            <AnimatedPressable key={event.id} onPress={() => setEventId(event.id)} style={[styles.eventChip, { borderColor: eventId === event.id ? colors.green500 : theme.border, backgroundColor: eventId === event.id ? theme.surfaceMuted : theme.surface }]}>
              <Text numberOfLines={1} style={[styles.eventChipText, { color: theme.textPrimary }]}>{event.emoji} {event.title}</Text>
            </AnimatedPressable>
          ))}
        </ScrollView>

        <AnimatedPressable onPress={post} disabled={!asset || posting} style={[styles.postButton, { backgroundColor: colors.green500, opacity: !asset || posting ? 0.55 : 1 }]}>
          <Text style={styles.postText}>{posting ? t.newStory.posting : t.newStory.postStory}</Text>
        </AnimatedPressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  content: { padding: spacing.lg, paddingBottom: 50, gap: 8 },
  mediaCard: { height: 330, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  preview: { width: '100%', height: '100%' },
  mediaEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 8 },
  mediaTitle: { fontSize: 17, fontWeight: '800' },
  mediaHint: { fontSize: 12, textAlign: 'center', lineHeight: 17 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginTop: spacing.md, marginBottom: 2 },
  textInput: { minHeight: 88, borderRadius: 14, borderWidth: 1, padding: 13, fontSize: 14, textAlignVertical: 'top' },
  visibilityRow: { flexDirection: 'row', gap: spacing.sm },
  visibilityButton: { flex: 1, minHeight: 46, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  visibilityText: { fontSize: 13, fontWeight: '800' },
  eventsRow: { gap: spacing.sm, paddingRight: spacing.lg },
  eventChip: { maxWidth: 190, borderRadius: 13, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  eventChipText: { fontSize: 12, fontWeight: '700' },
  postButton: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl },
  postText: { color: colors.white, fontSize: 15, fontWeight: '900' },
});
