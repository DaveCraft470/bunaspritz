import { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { addReport, hasActiveReport, ReportTargetType } from '@/lib/reports';

const CUSTOM_REASON = 'Alt motiv';

type Phase = 'form' | 'submitting' | 'success' | 'duplicate' | 'error';

// Report flow is fully self-contained: it owns reason selection, the custom
// free-text reason, duplicate-prevention, and the submit/loading/success
// states, so user & event report screens just render this with their target
// info instead of re-implementing the same logic.
export function ReportModal({
  visible,
  targetType,
  targetId,
  targetLabel,
  reasons,
  reporterId,
  reporterLabel,
  onClose,
}: {
  visible: boolean;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel: string;
  reasons: readonly string[];
  reporterId: string;
  reporterLabel: string;
  onClose: () => void;
}) {
  const { colors: theme } = useAppTheme();
  const [reason, setReason] = useState('');
  const [customText, setCustomText] = useState('');
  const [phase, setPhase] = useState<Phase>('form');

  const isCustomReason = reason === CUSTOM_REASON;
  const canSubmit = (phase === 'form' || phase === 'error') && !!reason;

  function reset() {
    setReason('');
    setCustomText('');
    setPhase('form');
  }

  function close() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    Keyboard.dismiss();
    setPhase('submitting');
    if (await hasActiveReport(reporterId, targetType, targetId)) {
      setPhase('duplicate');
      return;
    }
    const report = await addReport({
      reporterId,
      reporterLabel,
      targetType,
      targetId,
      targetLabel,
      reason,
      description: isCustomReason ? customText.trim() : '',
    });
    if (!report) {
      setPhase('error');
      return;
    }
    setPhase('success');
    setTimeout(close, 1100);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={phase === 'submitting' ? undefined : close}>
      <KeyboardAvoidingView style={styles.backdropWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={phase === 'submitting' ? undefined : close}>
          <Pressable style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {phase === 'success' ? (
              <View style={styles.statusWrap}>
                <Ionicons name="checkmark-circle" size={40} color={colors.green500} />
                <Text style={[styles.statusTitle, { color: theme.textPrimary }]}>Raport trimis</Text>
                <Text style={[styles.statusText, { color: theme.textSecondary }]}>
                  Raportul a fost trimis către echipa de moderare.
                </Text>
              </View>
            ) : (
              <>
                <Text style={[styles.title, { color: theme.textPrimary }]}>
                  Raportează {targetType === 'user' ? 'utilizatorul' : 'evenimentul'}
                </Text>
                <Text style={[styles.target, { color: theme.textSecondary }]} numberOfLines={1}>{targetLabel}</Text>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Alege motivul</Text>
                <View style={styles.reasons}>
                  {reasons.map((item) => (
                    <Pressable
                      key={item}
                      disabled={phase === 'submitting'}
                      onPress={() => setReason(item)}
                      style={[
                        styles.reason,
                        { borderColor: reason === item ? colors.green500 : theme.border, backgroundColor: reason === item ? theme.surfaceMuted : theme.surface },
                      ]}
                    >
                      <Text style={[styles.reasonText, { color: theme.textPrimary }]}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
                {isCustomReason && (
                  <TextInput
                    value={customText}
                    onChangeText={setCustomText}
                    editable={phase === 'form'}
                    multiline
                    placeholder="Descrie motivul (opțional)"
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]}
                  />
                )}
                {phase === 'duplicate' && (
                  <Text style={styles.duplicateText}>
                    Ai raportat deja {targetType === 'user' ? 'acest utilizator' : 'acest eveniment'}.
                  </Text>
                )}
                {phase === 'error' && (
                  <Text style={styles.duplicateText}>Nu am putut trimite raportul. Încearcă din nou.</Text>
                )}
                <View style={styles.actions}>
                  <Pressable disabled={phase === 'submitting'} onPress={close} style={[styles.button, { backgroundColor: theme.surfaceMuted }]}>
                    <Text style={[styles.buttonText, { color: theme.textPrimary }]}>Anulează</Text>
                  </Pressable>
                  <Pressable
                    disabled={!canSubmit}
                    onPress={handleSubmit}
                    style={[styles.button, { backgroundColor: canSubmit ? colors.green500 : theme.surfaceMuted }]}
                  >
                    {phase === 'submitting' ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={[styles.buttonText, { color: canSubmit ? colors.white : theme.textSecondary }]}>Trimite raportul</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  card: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: spacing.xl, paddingBottom: 32 },
  title: { fontSize: 18, fontWeight: '800' },
  target: { fontSize: 12, marginTop: 4, marginBottom: spacing.lg },
  label: { fontSize: 12, fontWeight: '700', marginBottom: spacing.sm },
  reasons: { gap: 7 },
  reason: { borderWidth: 1, borderRadius: 11, padding: 10 },
  reasonText: { fontSize: 12, fontWeight: '600' },
  input: { minHeight: 72, borderWidth: 1, borderRadius: 12, padding: 10, marginTop: spacing.md, textAlignVertical: 'top' },
  duplicateText: { fontSize: 12, color: '#E5484D', fontWeight: '700', marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  button: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 12, fontWeight: '800' },
  statusWrap: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  statusTitle: { fontSize: 16, fontWeight: '800' },
  statusText: { fontSize: 12, textAlign: 'center' },
});
