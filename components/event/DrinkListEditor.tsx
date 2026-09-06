import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { formatDrinkVolume, searchDrinkCatalog, type DrinkCategory, type DrinkQuickFilter, type EventDrink } from '@/lib/drinks';
import { addOpenFoodFactsDrinkToEvent, lookupDrinkByBarcode, type OpenFoodFactsDrink } from '@/lib/openFoodFacts';

const categoryFilters: Array<{ label: string; value: DrinkQuickFilter }> = [
  { label: 'Toate', value: 'all' },
  { label: 'Spirtoase', value: 'spirits' },
  { label: 'Bere', value: 'beer' },
  { label: 'Vin', value: 'wine' },
  { label: 'Soft', value: 'soft' },
  { label: 'Energie', value: 'energy' },
];

export function DrinkListEditor({ value, onChange }: { value: EventDrink[]; onChange: (drinks: EventDrink[]) => void }) {
  const { colors: theme } = useAppTheme();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<DrinkQuickFilter>('all');
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customVolume, setCustomVolume] = useState('');
  const [browseAll, setBrowseAll] = useState(false);
  const [onlineDrink, setOnlineDrink] = useState<OpenFoodFactsDrink | null>(null);
  const [barcode, setBarcode] = useState('');
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const suggestions = useMemo(() => searchDrinkCatalog(query, category, query || category !== 'all' ? 12 : 200), [browseAll, category, query]);

  function addDrink(name: string, brand: string, drinkCategory: DrinkCategory, volumeMl?: number, productId?: string) {
    const existing = value.find((drink) => (drink.productId ?? drink.name) === (productId ?? name) && drink.volumeMl === volumeMl);
    if (existing) {
      onChange(value.map((drink) => drink.id === existing.id ? { ...drink, quantity: drink.quantity + 1 } : drink));
    } else {
      onChange([...value, { id: `drink-${Date.now()}-${Math.random().toString(36).slice(2)}`, productId, name, brand, category: drinkCategory, volumeMl, quantity: 1 }]);
    }
    setQuery('');
  }

  function addCustom() {
    const name = customName.trim();
    if (!name) return;
    const volume = customVolume.trim() ? Number(customVolume) : undefined;
    addDrink(name, '', 'Cocktails / Spritz ingredients', Number.isFinite(volume) && volume! > 0 ? volume : undefined);
    setCustomName('');
    setCustomVolume('');
    setCustomOpen(false);
  }

  function updateQuantity(id: string, delta: number) {
    onChange(value.map((drink) => drink.id === id ? { ...drink, quantity: Math.max(1, drink.quantity + delta) } : drink));
  }

  async function lookupOnline() {
    const value = barcode.trim();
    if (!value || onlineLoading) return;
    setOnlineLoading(true);
    setOnlineError(null);
    const result = await lookupDrinkByBarcode(value);
    setOnlineLoading(false);
    if (!result) {
      setOnlineError('Produsul nu a fost găsit sau nu este o băutură.');
      return;
    }
    setOnlineDrink(result);
  }

  function addOnlineDrink() {
    if (!onlineDrink) return;
    const next = addOpenFoodFactsDrinkToEvent(onlineDrink);
    const existing = value.find((drink) => drink.productId === next.productId && drink.volumeMl === next.volumeMl && drink.packagingType === next.packagingType);
    onChange(existing ? value.map((drink) => drink.id === existing.id ? { ...drink, quantity: drink.quantity + 1 } : drink) : [...value, next]);
    setOnlineDrink(null);
    setBarcode('');
  }

  return (
    <View style={styles.container}>
      <TextInput value={query} onChangeText={(value) => { setQuery(value); setBrowseAll(false); }} placeholder="Caută o băutură..." placeholderTextColor={theme.textSecondary} style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {categoryFilters.map((filter) => (
          <AnimatedPressable key={filter.value} onPress={() => { setCategory(filter.value); setBrowseAll(false); }} style={[styles.filter, { backgroundColor: category === filter.value ? colors.green500 : theme.surface, borderColor: theme.border }]}> 
            <Text style={[styles.filterText, { color: category === filter.value ? colors.white : theme.textSecondary }]}>{filter.label}</Text>
          </AnimatedPressable>
        ))}
      </ScrollView>
      {!query && category === 'all' && !browseAll && <AnimatedPressable onPress={() => setBrowseAll(true)} style={[styles.browseAllButton, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}><Ionicons name="list-outline" size={16} color={theme.accent} /><Text style={[styles.browseAllText, { color: theme.accent }]}>Toate băuturile</Text></AnimatedPressable>}
      {(query || category !== 'all' || browseAll) && (
        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator contentContainerStyle={styles.suggestionList} style={[styles.suggestions, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
          {suggestions.map((item) => (
            <View key={item.id} style={[styles.suggestionGroup, { borderBottomColor: theme.border }]}>
              <Text style={[styles.suggestionName, { color: theme.textPrimary }]}>{item.name}</Text>
              {item.brand && item.brand !== item.name && <Text style={[styles.suggestionBrand, { color: theme.textSecondary }]}>{item.brand}</Text>}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.volumes}>
                {item.volumesMl.map((volume) => (
                  <AnimatedPressable key={volume} onPress={() => addDrink(item.name, item.brand, item.category, volume, item.id)} style={[styles.volumeChip, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}> 
                    <Text style={[styles.volumeText, { color: theme.accent }]}>{formatDrinkVolume(volume)}{value.find((drink) => (drink.productId ?? drink.name) === item.id && drink.volumeMl === volume) ? ` · ✓ ${value.find((drink) => (drink.productId ?? drink.name) === item.id && drink.volumeMl === volume)?.quantity} buc.` : ''}</Text>
                  </AnimatedPressable>
                ))}
              </ScrollView>
            </View>
          ))}
          {suggestions.length === 0 && <Text style={[styles.noResults, { color: theme.textSecondary }]}>Nu există rezultate în catalog.</Text>}
          <AnimatedPressable onPress={() => setCustomOpen(true)} style={styles.customButton}><Ionicons name="add" size={16} color={theme.accent} /><Text style={[styles.customText, { color: theme.accent }]}>Adaugă băutură personalizată</Text></AnimatedPressable>
        </ScrollView>
      )}
      <View style={styles.onlineHeading}><Ionicons name="barcode-outline" size={16} color={theme.accent} /><Text style={[styles.onlineLinkText, { color: theme.accent }]}>Nu găsești băutura? Verifică online</Text></View>
      <View style={[styles.onlineLookup, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}> 
        <TextInput value={barcode} onChangeText={setBarcode} placeholder="Cod de bare" keyboardType="number-pad" placeholderTextColor={theme.textSecondary} style={[styles.barcodeInput, { color: theme.textPrimary }]} />
        <AnimatedPressable onPress={lookupOnline} disabled={onlineLoading || !barcode.trim()} style={[styles.lookupButton, { backgroundColor: colors.green500, opacity: onlineLoading || !barcode.trim() ? 0.5 : 1 }]}><Text style={styles.lookupText}>{onlineLoading ? '...' : 'Caută'}</Text></AnimatedPressable>
      </View>
      {onlineError && <Text style={[styles.onlineError, { color: '#E5484D' }]}>{onlineError}</Text>}
      {onlineDrink && (
        <View style={[styles.onlineResult, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
          <View style={styles.onlineCopy}><Text style={[styles.onlineName, { color: theme.textPrimary }]}>{onlineDrink.name}</Text><Text style={[styles.onlineMeta, { color: theme.textSecondary }]}>{onlineDrink.brand ?? 'Brand necunoscut'}{onlineDrink.volumesMl[0] ? ` · ${formatDrinkVolume(onlineDrink.volumesMl[0])}` : ''}{onlineDrink.packagingTypes?.[0] ? ` · ${onlineDrink.packagingTypes[0]}` : ''}</Text><Text style={[styles.onlineSource, { color: theme.textSecondary }]}>Din catalog online</Text></View><AnimatedPressable onPress={addOnlineDrink} style={[styles.onlineAdd, { backgroundColor: colors.green500 }]}><Text style={styles.onlineAddText}>Adaugă</Text></AnimatedPressable>
        </View>
      )}
      {value.map((drink) => (
        <View key={drink.id} style={[styles.selectedRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.selectedCopy}><Text style={[styles.selectedName, { color: theme.textPrimary }]} numberOfLines={1}>{drink.name}</Text><Text style={[styles.selectedMeta, { color: theme.textSecondary }]}>{formatDrinkVolume(drink.volumeMl)}{drink.brand ? ` · ${drink.brand}` : ''}</Text></View>
          <AnimatedPressable onPress={() => updateQuantity(drink.id, -1)} style={[styles.quantityButton, { backgroundColor: theme.surfaceMuted }]}><Text style={[styles.quantitySymbol, { color: theme.textPrimary }]}>−</Text></AnimatedPressable>
          <Text style={[styles.quantity, { color: theme.textPrimary }]}>{drink.quantity}</Text>
          <AnimatedPressable onPress={() => updateQuantity(drink.id, 1)} style={[styles.quantityButton, { backgroundColor: colors.green500 }]}><Text style={[styles.quantitySymbol, { color: colors.white }]}>+</Text></AnimatedPressable>
          <AnimatedPressable onPress={() => onChange(value.filter((item) => item.id !== drink.id))} hitSlop={8} style={styles.deleteButton}><Ionicons name="trash-outline" size={17} color="#E5484D" /></AnimatedPressable>
        </View>
      ))}
      <Modal visible={customOpen} transparent animationType="fade" onRequestClose={() => setCustomOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCustomOpen(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Băutură personalizată</Text>
            <TextInput value={customName} onChangeText={setCustomName} placeholder="Nume" placeholderTextColor={theme.textSecondary} style={[styles.modalInput, { color: theme.textPrimary, borderColor: theme.border }]} />
            <TextInput value={customVolume} onChangeText={setCustomVolume} placeholder="Volum în ml (opțional)" keyboardType="number-pad" placeholderTextColor={theme.textSecondary} style={[styles.modalInput, { color: theme.textPrimary, borderColor: theme.border }]} />
            <AnimatedPressable onPress={addCustom} style={[styles.addCustomButton, { backgroundColor: colors.green500 }]}><Text style={styles.addCustomText}>Adaugă</Text></AnimatedPressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  search: { minHeight: 46, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, fontSize: 14 },
  filters: { gap: 7, paddingRight: 12 },
  filter: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  filterText: { fontSize: 11, fontWeight: '800' },
  suggestions: { maxHeight: 430, borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  suggestionList: { paddingVertical: 2 },
  suggestionGroup: { padding: 10, borderBottomWidth: 1, gap: 7 },
  suggestionName: { fontSize: 13, fontWeight: '800' },
  suggestionBrand: { fontSize: 10, marginTop: -4 },
  volumes: { gap: 6 },
  volumeChip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7 },
  volumeText: { fontSize: 11, fontWeight: '800' },
  noResults: { padding: 12, fontSize: 12 },
  customButton: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 11 },
  customText: { fontSize: 12, fontWeight: '800' },
  browseAllButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 12 },
  browseAllText: { fontSize: 12, fontWeight: '800' },
  onlineHeading: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, marginTop: 4 },
  onlineLinkText: { fontSize: 12, fontWeight: '800' },
  onlineLookup: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 5 },
  barcodeInput: { flex: 1, minHeight: 38, paddingHorizontal: 9, fontSize: 13 },
  lookupButton: { minHeight: 38, paddingHorizontal: 14, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  lookupText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  onlineError: { fontSize: 11, paddingHorizontal: 4 },
  onlineResult: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 10 },
  onlineCopy: { flex: 1, minWidth: 0 },
  onlineName: { fontSize: 13, fontWeight: '800' },
  onlineMeta: { fontSize: 11, marginTop: 2 },
  onlineSource: { fontSize: 10, marginTop: 4, fontStyle: 'italic' },
  onlineAdd: { minHeight: 40, borderRadius: 10, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  onlineAddText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  selectedRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, padding: 9 },
  selectedCopy: { flex: 1, minWidth: 0 },
  selectedName: { fontSize: 13, fontWeight: '800' },
  selectedMeta: { fontSize: 11, marginTop: 2 },
  quantityButton: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quantitySymbol: { fontSize: 21, fontWeight: '700', marginTop: -2 },
  quantity: { minWidth: 18, textAlign: 'center', fontSize: 14, fontWeight: '800' },
  deleteButton: { padding: 5 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: { borderWidth: 1, borderRadius: 18, padding: spacing.lg, gap: 10 },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  modalInput: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 14 },
  addCustomButton: { minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addCustomText: { color: colors.white, fontWeight: '800' },
});
