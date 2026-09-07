import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { getTrendingGifs, searchGifs, type GifResult } from '@/lib/giphy';

const GIF_COLUMNS = 3;

export function GifPickerModal({
  visible,
  onSelect,
  onClose,
}: {
  visible: boolean;
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}) {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setLoading(true);
    getTrendingGifs().then((gifs) => setResults(gifs)).finally(() => setLoading(false));
  }, [visible]);

  // Debounced search — a search-per-keystroke would hammer the Giphy API.
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setLoading(true);
      searchGifs(query).then((gifs) => setResults(gifs)).finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [query, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={styles.header}>
            <View style={[styles.searchBox, { backgroundColor: theme.surfaceMuted }]}>
              <Ionicons name="search-outline" size={16} color={theme.textSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Caută un GIF..."
                placeholderTextColor={theme.textSecondary}
                style={[styles.searchInput, { color: theme.textPrimary }]}
                autoFocus
              />
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Închide">
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.green500} style={styles.loading} />
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              numColumns={GIF_COLUMNS}
              contentContainerStyle={styles.grid}
              ListEmptyComponent={
                <Text style={[styles.empty, { color: theme.textSecondary }]}>Niciun GIF găsit.</Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    light();
                    onSelect(item.fullUrl);
                  }}
                  style={styles.cell}
                >
                  <Image source={{ uri: item.previewUrl }} style={styles.cellImage} resizeMode="cover" />
                </Pressable>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { height: '65%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: { flex: 1, fontSize: 13 },
  loading: { marginTop: spacing.xl },
  grid: { paddingBottom: spacing.xl },
  cell: { width: `${100 / GIF_COLUMNS}%`, aspectRatio: 1, padding: 3 },
  cellImage: { flex: 1, borderRadius: 10, backgroundColor: '#00000010' },
  empty: { textAlign: 'center', marginTop: spacing.xl, fontSize: 13 },
});
