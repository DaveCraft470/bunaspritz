import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { ReportTargetType } from '@/lib/reports';

export function ReportModal({ visible, targetType, targetLabel, reasons, onSubmit, onClose }: {
  visible: boolean;
  targetType: ReportTargetType;
  targetLabel: string;
  reasons: readonly string[];
  onSubmit: (reason: string, description: string) => void;
  onClose: () => void;
}) {
  const { colors: theme } = useAppTheme();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  function close() {
    setReason('');
    setDescription('');
    onClose();
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Raportează {targetType === 'user' ? 'utilizatorul' : 'evenimentul'}</Text>
          <Text style={[styles.target, { color: theme.textSecondary }]}>{targetLabel}</Text>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Alege motivul</Text>
          <View style={styles.reasons}>
            {reasons.map((item) => (
              <Pressable key={item} onPress={() => setReason(item)} style={[styles.reason, { borderColor: reason === item ? colors.green500 : theme.border, backgroundColor: reason === item ? theme.surfaceMuted : theme.surface }]}>
                <Text style={[styles.reasonText, { color: theme.textPrimary }]}>{item}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput value={description} onChangeText={setDescription} multiline placeholder="Descriere opțională" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]} />
          <View style={styles.actions}>
            <Pressable onPress={close} style={[styles.button, { backgroundColor: theme.surfaceMuted }]}><Text style={[styles.buttonText, { color: theme.textPrimary }]}>Anulează</Text></Pressable>
            <Pressable disabled={!reason} onPress={() => { onSubmit(reason, description.trim()); close(); }} style={[styles.button, { backgroundColor: reason ? colors.green500 : theme.surfaceMuted }]}><Text style={[styles.buttonText, { color: reason ? colors.white : theme.textSecondary }]}>Trimite raport</Text></Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  card: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: spacing.xl, paddingBottom: 32 },
  title: { fontSize: 18, fontWeight: '800' },
  target: { fontSize: 12, marginTop: 4, marginBottom: spacing.lg },
  label: { fontSize: 12, fontWeight: '700', marginBottom: spacing.sm },
  reasons: { gap: 7 },
  reason: { borderWidth: 1, borderRadius: 11, padding: 10 },
  reasonText: { fontSize: 12, fontWeight: '600' },
  input: { minHeight: 72, borderWidth: 1, borderRadius: 12, padding: 10, marginTop: spacing.md, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  button: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 12, fontWeight: '800' },
});
