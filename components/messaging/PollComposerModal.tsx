import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';

const MAX_OPTIONS = 6;

// Create-a-poll form: a question plus 2-6 options. Kept as local component
// state (not lifted) since nothing outside needs the draft while it's open —
// onCreate only fires once, with the final trimmed values.
export function PollComposerModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (question: string, options: string[]) => void;
}) {
  const { colors: theme } = useAppTheme();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  function reset() {
    setQuestion('');
    setOptions(['', '']);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function updateOption(index: number, value: string) {
    setOptions((current) => current.map((o, i) => (i === index ? value : o)));
  }

  function addOption() {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((current) => [...current, '']);
  }

  function removeOption(index: number) {
    setOptions((current) => current.filter((_, i) => i !== index));
  }

  const validOptions = options.map((o) => o.trim()).filter(Boolean);
  const canCreate = question.trim().length > 0 && validOptions.length >= 2;

  function handleCreate() {
    if (!canCreate) return;
    onCreate(question.trim(), validOptions);
    reset();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Sondaj nou</Text>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="Întrebarea ta..."
            placeholderTextColor={theme.textSecondary}
            style={[styles.questionInput, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}
            maxLength={200}
          />
          <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
            {options.map((option, index) => (
              <View key={index} style={styles.optionRow}>
                <TextInput
                  value={option}
                  onChangeText={(value) => updateOption(index, value)}
                  placeholder={`Opțiunea ${index + 1}`}
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.optionInput, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}
                  maxLength={80}
                />
                {options.length > 2 && (
                  <Pressable onPress={() => removeOption(index)} hitSlop={8} accessibilityLabel="Șterge opțiunea">
                    <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                  </Pressable>
                )}
              </View>
            ))}
          </ScrollView>
          {options.length < MAX_OPTIONS && (
            <Pressable onPress={addOption} style={styles.addOption}>
              <Ionicons name="add-circle-outline" size={18} color={colors.green500} />
              <Text style={[styles.addOptionText, { color: colors.green500 }]}>Adaugă opțiune</Text>
            </Pressable>
          )}
          <Pressable
            onPress={handleCreate}
            disabled={!canCreate}
            style={[styles.createButton, { backgroundColor: colors.green500, opacity: canCreate ? 1 : 0.5 }]}
          >
            <Text style={styles.createButtonText}>Creează sondajul</Text>
          </Pressable>
          <Pressable onPress={handleClose} style={[styles.cancel, { backgroundColor: theme.surfaceMuted }]}>
            <Text style={[styles.cancelText, { color: theme.textPrimary }]}>Anulează</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  card: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: spacing.xl, paddingBottom: 32, maxHeight: '80%' },
  title: { fontSize: 16, fontWeight: '800', marginBottom: spacing.md },
  questionInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: spacing.md },
  optionsList: { maxHeight: 220 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  optionInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  addOption: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  addOptionText: { fontSize: 13, fontWeight: '800' },
  createButton: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  createButtonText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  cancel: { minHeight: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  cancelText: { fontSize: 13, fontWeight: '800' },
});
