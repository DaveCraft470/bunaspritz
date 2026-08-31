import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import { MAPBOX_INITIAL_VIEW } from '@/constants/mapbox';
import { useEvents } from '@/contexts/EventsContext';
import { useDevFlags } from '@/contexts/DevFlagsContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { createEvent } from '@/lib/events';
import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { GlassSurface } from '@/components/common/GlassSurface';

const EMOJI_CHOICES = ['🎉', '🍻', '🎷', '🎸', '🌮', '🎲', '🥾', '🧺', '⛰️', '🍹'];
const COLOR_CHOICES = ['#FF9F5A', '#5FD98A', '#5AA9E6', '#FFD25A', '#FF6B81', '#B388FF', '#4ED9C9'];

export default function NewEvent() {
  const { colors: theme } = useAppTheme();
  const { hostVerified } = useDevFlags();
  const { addEvent } = useEvents();
  const { user } = useUser();
  const { light, medium } = useHaptics();
  const [publishing, setPublishing] = useState(false);

  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [genre, setGenre] = useState('');
  const [emoji, setEmoji] = useState(EMOJI_CHOICES[0]);
  const [coords, setCoords] = useState<{ lng: number; lat: number } | null>(null);

  // This screen is only ever linked to when hostVerified is on, but guard
  // against reaching it some other way (deep link, back-forward, etc).
  useEffect(() => {
    if (!hostVerified) router.back();
  }, [hostVerified]);

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

  async function handlePublish() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Mai e nevoie de un nume', 'Dă-i evenimentului un titlu înainte să-l publici.');
      return;
    }
    if (!user || publishing) return;

    const finalCoords = coords ?? { lng: MAPBOX_INITIAL_VIEW.center[0], lat: MAPBOX_INITIAL_VIEW.center[1] };
    const color = COLOR_CHOICES[Math.floor(Math.random() * COLOR_CHOICES.length)];

    setPublishing(true);
    const created = await createEvent(user.id, {
      title: trimmedTitle,
      detail: detail.trim() || 'Detalii în curând',
      emoji,
      color,
      lng: finalCoords.lng,
      lat: finalCoords.lat,
      genre: genre.trim() || 'Surpriză',
    });
    setPublishing(false);

    if (!created) {
      Alert.alert('A apărut o eroare', 'Nu am putut publica evenimentul. Încearcă din nou.');
      return;
    }

    medium();
    addEvent(created);
    router.replace({ pathname: '/event/[id]', params: { id: created.id } });
  }

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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>TITLU</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Ex: Grătar la iarbă verde"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]}
        />

        <Text style={[styles.label, { color: theme.textSecondary }]}>LOCAȚIE ȘI ORĂ</Text>
        <TextInput
          value={detail}
          onChangeText={setDetail}
          placeholder="Ex: Parcul Central · 18:00"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]}
        />

        <Text style={[styles.label, { color: theme.textSecondary }]}>MUZICĂ / GEN</Text>
        <TextInput
          value={genre}
          onChangeText={setGenre}
          placeholder="Ex: Manele & trap"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]}
        />

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

        <Text style={[styles.locationHint, { color: theme.textSecondary }]}>
          {coords
            ? 'Evenimentul va apărea pe hartă la locația ta curentă.'
            : 'Evenimentul va apărea pe hartă în centrul Brașovului (nu ți-am găsit locația).'}
        </Text>

        <AnimatedPressable
          onPress={handlePublish}
          style={[styles.publishButton, shadows.glowGreen, publishing && styles.publishButtonDisabled]}
        >
          <Text style={styles.publishText}>{publishing ? 'Se publică...' : 'Publică evenimentul'}</Text>
        </AnimatedPressable>
      </ScrollView>
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
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
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
  locationHint: { fontSize: 11, fontStyle: 'italic', marginTop: 18, marginBottom: 20 },
  publishButton: {
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishButtonDisabled: { opacity: 0.7 },
  publishText: { color: colors.white, fontSize: 17, fontWeight: '900' },
});
