import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { ReviewableEvent } from '@/lib/reviews';

const COMMENT_MAX_LENGTH = 300;

export function ReviewModal({
  visible,
  subjectName,
  events,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  subjectName: string;
  events: ReviewableEvent[];
  onSubmit: (eventId: string, rating: number, comment: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const [eventId, setEventId] = useState(events[0]?.eventId ?? '');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const activeEventId = eventId || events[0]?.eventId || '';

  async function handleSubmit() {
    if (!activeEventId || rating < 1 || saving) return;
    setSaving(true);
    const ok = await onSubmit(activeEventId, rating, comment);
    setSaving(false);
    if (ok) {
      light();
      setRating(0);
      setComment('');
      onClose();
    } else {
      Alert.alert('A apărut o eroare', 'Nu am putut trimite review-ul. Încearcă din nou.');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Cum a fost spritz-ul cu {subjectName}?</Text>

          {events.length > 1 && (
            <View style={styles.eventPicker}>
              {events.map((event) => (
                <Pressable
                  key={event.eventId}
                  onPress={() => {
                    light();
                    setEventId(event.eventId);
                  }}
                  style={[
                    styles.eventChip,
                    { borderColor: theme.border },
                    activeEventId === event.eventId && { backgroundColor: colors.green500, borderColor: colors.green500 },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.eventChipText,
                      { color: activeEventId === event.eventId ? colors.white : theme.textPrimary },
                    ]}
                  >
                    {event.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                onPress={() => {
                  light();
                  setRating(value);
                }}
                hitSlop={6}
              >
                <Ionicons
                  name={value <= rating ? 'star' : 'star-outline'}
                  size={34}
                  color={value <= rating ? '#F5B301' : theme.textSecondary}
                />
              </Pressable>
            ))}
          </View>

          <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Lasă câteva cuvinte (opțional)"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.textPrimary }]}
              multiline
              numberOfLines={3}
              maxLength={COMMENT_MAX_LENGTH}
            />
          </View>
          <Text style={[styles.counter, { color: theme.textSecondary }]}>
            {comment.length}/{COMMENT_MAX_LENGTH}
          </Text>

          <Pressable
            onPress={handleSubmit}
            disabled={rating < 1 || saving}
            style={[styles.submit, { backgroundColor: colors.green500, opacity: rating < 1 || saving ? 0.5 : 1 }]}
          >
            <Text style={styles.submitText}>Trimite review-ul</Text>
          </Pressable>

          <Pressable onPress={onClose} style={[styles.close, { backgroundColor: theme.surfaceMuted }]}>
            <Text style={[styles.closeText, { color: theme.textPrimary }]}>Anulează</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  card: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 20, paddingBottom: 32 },
  title: { fontSize: 16, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  eventPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16, justifyContent: 'center' },
  eventChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1, maxWidth: 160 },
  eventChipText: { fontSize: 12, fontWeight: '700' },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 18 },
  inputWrapper: { minHeight: 78, borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  input: { fontSize: 14, minHeight: 58, textAlignVertical: 'top' },
  counter: { fontSize: 11, textAlign: 'right', marginBottom: spacing.md, marginTop: 4 },
  submit: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  close: { minHeight: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  closeText: { fontSize: 13, fontWeight: '800' },
});
