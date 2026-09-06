import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { addManualSong, searchMusic, type SongCatalogItem } from '@/lib/music';
import { MusicCoverPlaceholder } from '@/components/music/MusicCoverPlaceholder';

export function MusicPlaylistEditor({ value, onChange }: { value: SongCatalogItem[]; onChange: (songs: SongCatalogItem[]) => void }) {
  const { colors: theme } = useAppTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SongCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualArtist, setManualArtist] = useState('');
  const [manualAlbum, setManualAlbum] = useState('');

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setError(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(false);
      setResults([]);
      try {
        const next = await searchMusic(query);
        if (!cancelled) setResults(next);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function addSong(song: SongCatalogItem) {
    const duplicate = value.some((item) => item.id === song.id || (item.title.toLowerCase() === song.title.toLowerCase() && item.artist.toLowerCase() === song.artist.toLowerCase()));
    if (!duplicate) onChange([...value, song]);
    setQuery('');
    setResults([]);
  }

  function addManual() {
    const song = addManualSong(manualTitle, manualArtist, manualAlbum);
    if (song) onChange([...value, song]);
    setManualTitle('');
    setManualArtist('');
    setManualAlbum('');
    setManualOpen(false);
  }

  return (
    <View style={styles.container}>
      <TextInput value={query} onChangeText={setQuery} placeholder="Caută o melodie sau un artist..." placeholderTextColor={theme.textSecondary} style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]} />
      {query.trim().length > 0 && query.trim().length < 2 && <Text style={[styles.hint, { color: theme.textSecondary }]}>Introdu cel puțin 2 caractere pentru căutare.</Text>}
      {loading && <Text style={[styles.hint, { color: theme.textSecondary }]}>Se caută în Deezer...</Text>}
      {error && <Text style={styles.error}>Nu am putut căuta acum. Melodiile deja selectate rămân disponibile.</Text>}
      {results.length > 0 && (
        <ScrollView style={[styles.results, { backgroundColor: theme.surface, borderColor: theme.border }]} nestedScrollEnabled>
          {results.map((song) => (
              <View key={song.id} style={[styles.resultRow, { borderBottomColor: theme.border }]}> 
              {song.coverUrl ? <Image source={{ uri: song.coverUrl }} style={styles.cover} /> : <MusicCoverPlaceholder size={44} />}
              <View style={styles.songCopy}><Text style={[styles.songTitle, { color: theme.textPrimary }]} numberOfLines={1}>{song.title}</Text><Text style={[styles.songArtist, { color: theme.textSecondary }]} numberOfLines={1}>{song.artist}{song.album ? ` · ${song.album}` : ''}</Text><Text style={[styles.source, { color: theme.textSecondary }]}>Deezer</Text></View>
              <AnimatedPressable onPress={() => addSong(song)} disabled={value.some((item) => item.id === song.id)} style={[styles.addButton, { backgroundColor: colors.green500, opacity: value.some((item) => item.id === song.id) ? 0.55 : 1 }]}><Text style={styles.addText}>{value.some((item) => item.id === song.id) ? '✓ Adăugat' : 'Adaugă'}</Text></AnimatedPressable>
            </View>
          ))}
        </ScrollView>
      )}
      {query.trim().length >= 2 && !loading && !results.length && !error && <Text style={[styles.hint, { color: theme.textSecondary }]}>Nu am găsit melodia.</Text>}
      <AnimatedPressable onPress={() => setManualOpen(true)} style={[styles.manualButton, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}><Ionicons name="add" size={16} color={theme.accent} /><Text style={[styles.manualText, { color: theme.accent }]}>Adaugă melodie manual</Text></AnimatedPressable>
      <Text style={[styles.selectedHeading, { color: theme.textSecondary }]}>MELODII SELECTATE ({value.length})</Text>
      {value.length === 0 && <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Nu ai adăugat încă melodii. Caută câteva melodii care vor fi ascultate la eveniment.</Text>}
      {value.map((song, index) => (
        <View key={song.id} style={[styles.selectedRow, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
          {song.coverUrl ? <Image source={{ uri: song.coverUrl }} style={styles.coverSmall} /> : <MusicCoverPlaceholder size={36} />}
          <View style={styles.songCopy}><Text style={[styles.songTitle, { color: theme.textPrimary }]} numberOfLines={1}>{index + 1}. {song.title}</Text><Text style={[styles.songArtist, { color: theme.textSecondary }]} numberOfLines={1}>{song.artist}</Text></View>
          <AnimatedPressable onPress={() => onChange(value.filter((item) => item.id !== song.id))} hitSlop={8}><Ionicons name="trash-outline" size={17} color="#E5484D" /></AnimatedPressable>
        </View>
      ))}
      <Modal visible={manualOpen} transparent animationType="fade" onRequestClose={() => setManualOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setManualOpen(false)}><Pressable style={[styles.modal, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Adaugă melodie manual</Text><TextInput value={manualTitle} onChangeText={setManualTitle} placeholder="Titlu" placeholderTextColor={theme.textSecondary} style={[styles.modalInput, { color: theme.textPrimary, borderColor: theme.border }]} /><TextInput value={manualArtist} onChangeText={setManualArtist} placeholder="Artist" placeholderTextColor={theme.textSecondary} style={[styles.modalInput, { color: theme.textPrimary, borderColor: theme.border }]} /><TextInput value={manualAlbum} onChangeText={setManualAlbum} placeholder="Album (opțional)" placeholderTextColor={theme.textSecondary} style={[styles.modalInput, { color: theme.textPrimary, borderColor: theme.border }]} /><AnimatedPressable onPress={addManual} style={styles.modalButton}><Text style={styles.modalButtonText}>Adaugă</Text></AnimatedPressable></Pressable></Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  search: { minHeight: 46, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, fontSize: 14 },
  hint: { fontSize: 11, paddingHorizontal: 4 },
  error: { color: '#E5484D', fontSize: 11, paddingHorizontal: 4 },
  results: { maxHeight: 300, borderWidth: 1, borderRadius: 14 },
  resultRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 9, borderBottomWidth: 1 },
  cover: { width: 44, height: 44, borderRadius: 8 },
  coverSmall: { width: 36, height: 36, borderRadius: 7 },
  songCopy: { flex: 1, minWidth: 0 },
  songTitle: { fontSize: 13, fontWeight: '800' },
  songArtist: { fontSize: 11, marginTop: 2 },
  source: { fontSize: 9, marginTop: 3, fontStyle: 'italic' },
  addButton: { minHeight: 38, borderRadius: 10, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  addText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  manualButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 12 },
  manualText: { fontSize: 12, fontWeight: '800' },
  selectedHeading: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginTop: spacing.sm },
  emptyText: { fontSize: 11, lineHeight: 16, paddingHorizontal: 4 },
  selectedRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 13, padding: 9 },
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { borderWidth: 1, borderRadius: 18, padding: spacing.lg, gap: 10 },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  modalInput: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 14 },
  modalButton: { minHeight: 46, borderRadius: 12, backgroundColor: colors.green500, alignItems: 'center', justifyContent: 'center' },
  modalButtonText: { color: colors.white, fontWeight: '800' },
});
