import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useEvents } from '@/contexts/EventsContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { getDiscoveryGenres } from '@/lib/discovery';
import { alertPermissionDenied } from '@/lib/permissions';
import { showAlert } from '@/lib/alert';
import {
  FavoriteLocation,
  addFavoriteCategory,
  addFavoriteLocation,
  getFavoriteCategories,
  getFavoriteLocations,
  removeFavoriteCategory,
  removeFavoriteLocation,
} from '@/lib/favorites';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';

// Used to build "Favorite Categories" from genres this session has actually
// seen in Discover, plus whatever the user already picked (which might not
// be present in the currently-loaded events) — see selectableCategories.
export default function Favorites() {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const { user } = useUser();
  const { events } = useEvents();
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<FavoriteLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [addLocationOpen, setAddLocationOpen] = useState(false);
  const [locationLabel, setLocationLabel] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);

  const knownGenres = useMemo(() => getDiscoveryGenres(events), [events]);
  const selectableCategories = useMemo(
    () => Array.from(new Set([...knownGenres, ...categories])).sort((a, b) => a.localeCompare(b, 'ro-RO')),
    [knownGenres, categories],
  );

  useEffect(() => {
    if (!user) return;
    Promise.all([getFavoriteCategories(user.id), getFavoriteLocations(user.id)]).then(([cats, locs]) => {
      setCategories(cats);
      setLocations(locs);
      setLoading(false);
    });
  }, [user]);

  async function toggleCategory(category: string) {
    if (!user) return;
    light();
    const isSelected = categories.includes(category);
    setCategories((current) => (isSelected ? current.filter((c) => c !== category) : [...current, category]));
    const ok = isSelected ? await removeFavoriteCategory(user.id, category) : await addFavoriteCategory(user.id, category);
    if (!ok) setCategories((current) => (isSelected ? [...current, category] : current.filter((c) => c !== category)));
  }

  async function handleAddLocation() {
    if (!user || savingLocation) return;
    const label = locationLabel.trim();
    if (!label) return;
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      alertPermissionDenied(permission.canAskAgain, 'Activează locația ca să poți salva un loc favorit.');
      return;
    }
    setSavingLocation(true);
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const ok = await addFavoriteLocation(user.id, label, position.coords.latitude, position.coords.longitude);
    setSavingLocation(false);
    if (ok) {
      setLocations(await getFavoriteLocations(user.id));
      setLocationLabel('');
      setAddLocationOpen(false);
    } else {
      showAlert('A apărut o eroare', 'Nu am putut salva locația. Încearcă din nou.');
    }
  }

  async function handleRemoveLocation(id: string) {
    light();
    setLocations((current) => current.filter((l) => l.id !== id));
    await removeFavoriteLocation(id);
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />
      <View style={styles.topBar}>
        <AnimatedPressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityLabel="Înapoi"
          style={[styles.backButton, shadows.soft, { borderColor: glassButton.border }]}
        >
          <Ionicons name="chevron-back" size={20} color={glassButton.icon} />
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Preferințe</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.green500} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Categorii favorite</Text>
          <Text style={[styles.sectionHint, { color: theme.textSecondary }]}>
            Folosite ca să-ți arătăm evenimente mai relevante în Discover.
          </Text>
          <View style={styles.chips}>
            {selectableCategories.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Nu există încă genuri de evenimente disponibile.</Text>
            ) : (
              selectableCategories.map((category) => {
                const selected = categories.includes(category);
                return (
                  <AnimatedPressable
                    key={category}
                    onPress={() => toggleCategory(category)}
                    style={[styles.chip, { backgroundColor: selected ? colors.green500 : theme.surface, borderColor: theme.border }]}
                  >
                    <Text style={[styles.chipText, { color: selected ? colors.white : theme.textSecondary }]}>{category}</Text>
                  </AnimatedPressable>
                );
              })
            )}
          </View>

          <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginTop: spacing.xl }]}>Locații favorite</Text>
          <Text style={[styles.sectionHint, { color: theme.textSecondary }]}>
            Folosite pentru recomandări în funcție de unde ești de obicei.
          </Text>
          {locations.map((loc) => (
            <View key={loc.id} style={[styles.locationRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="location-outline" size={16} color={colors.green500} />
              <Text style={[styles.locationLabel, { color: theme.textPrimary }]}>{loc.label}</Text>
              <Pressable onPress={() => handleRemoveLocation(loc.id)} hitSlop={8}>
                <Ionicons name="close" size={18} color={theme.textSecondary} />
              </Pressable>
            </View>
          ))}
          <AnimatedPressable onPress={() => setAddLocationOpen(true)} style={[styles.addLocationButton, { borderColor: theme.border }]}>
            <Ionicons name="add-circle-outline" size={16} color={colors.green500} />
            <Text style={[styles.addLocationText, { color: colors.green500 }]}>Salvează locația curentă</Text>
          </AnimatedPressable>
        </ScrollView>
      )}

      <Modal visible={addLocationOpen} transparent animationType="fade" onRequestClose={() => setAddLocationOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setAddLocationOpen(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Nume pentru locația curentă</Text>
            <TextInput
              value={locationLabel}
              onChangeText={setLocationLabel}
              placeholder="Ex: Acasă, Facultate..."
              placeholderTextColor={theme.textSecondary}
              style={[styles.modalInput, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}
              maxLength={40}
              autoFocus
            />
            <AnimatedPressable
              onPress={handleAddLocation}
              disabled={!locationLabel.trim() || savingLocation}
              style={[styles.modalSave, { backgroundColor: colors.green500, opacity: !locationLabel.trim() || savingLocation ? 0.5 : 1 }]}
            >
              <Text style={styles.modalSaveText}>{savingLocation ? 'Se salvează...' : 'Salvează'}</Text>
            </AnimatedPressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 60 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  sectionHint: { fontSize: 12, marginTop: 3, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  chipText: { fontSize: 12, fontWeight: '700' },
  emptyText: { fontSize: 12, fontStyle: 'italic' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, marginBottom: spacing.sm },
  locationLabel: { flex: 1, fontSize: 13, fontWeight: '700' },
  addLocationButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 14, paddingVertical: 12, marginTop: 4, borderStyle: 'dashed' },
  addLocationText: { fontSize: 13, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', maxWidth: 360, borderRadius: 20, borderWidth: 1, padding: spacing.xl, gap: spacing.md },
  modalTitle: { fontSize: 15, fontWeight: '800' },
  modalInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  modalSave: { minHeight: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  modalSaveText: { color: colors.white, fontSize: 13, fontWeight: '800' },
});
