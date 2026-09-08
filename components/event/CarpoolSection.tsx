import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { Avatar } from '@/components/common/Avatar';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { showAlert } from '@/lib/alert';
import {
  CarpoolOffer,
  CarpoolRequest,
  getCarpoolOffers,
  getCarpoolRequests,
  offerCarpoolSeats,
  removeCarpoolOffer,
  removeCarpoolRequest,
  requestCarpoolSeat,
  subscribeToCarpool,
} from '@/lib/carpool';

type ProfileLookup = (userId: string) => { name: string; avatarUrl: string | null };

// "Am mașină" (offers) + "Caut transport" (requests) — coordination happens
// via each row's note plus the event's own group chat and meetup point
// (lib/meetupPoint.ts), not an in-app matching engine.
export function CarpoolSection({
  eventId,
  userId,
  profileLookup,
}: {
  eventId: string;
  userId: string;
  profileLookup: ProfileLookup;
}) {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const [offers, setOffers] = useState<CarpoolOffer[]>([]);
  const [requests, setRequests] = useState<CarpoolRequest[]>([]);
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [seatsDraft, setSeatsDraft] = useState('2');
  const [noteDraft, setNoteDraft] = useState('');

  function load() {
    getCarpoolOffers(eventId).then(setOffers);
    getCarpoolRequests(eventId).then(setRequests);
  }

  useEffect(() => {
    load();
    return subscribeToCarpool(eventId, load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const myOffer = offers.find((o) => o.driverId === userId);
  const myRequest = requests.find((r) => r.userId === userId);

  async function handleSubmitOffer() {
    const seats = Math.max(1, Math.min(8, Math.round(Number(seatsDraft) || 1)));
    light();
    setOfferModalOpen(false);
    const ok = await offerCarpoolSeats(eventId, userId, seats, noteDraft.trim());
    load();
    if (!ok) showAlert('A apărut o eroare', 'Nu am putut salva oferta de transport. Încearcă din nou.');
  }

  async function toggleRequest() {
    light();
    const ok = myRequest ? await removeCarpoolRequest(eventId, userId) : await requestCarpoolSeat(eventId, userId, '');
    load();
    if (!ok) showAlert('A apărut o eroare', 'Nu am putut actualiza cererea de transport. Încearcă din nou.');
  }

  async function handleRemoveOffer() {
    light();
    const ok = await removeCarpoolOffer(eventId, userId);
    load();
    if (!ok) showAlert('A apărut o eroare', 'Nu am putut anula oferta de transport. Încearcă din nou.');
  }

  if (offers.length === 0 && requests.length === 0 && !myOffer && !myRequest) {
    return (
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>CARPOOLING</Text>
        <View style={styles.actionsRow}>
          <AnimatedPressable onPress={() => setOfferModalOpen(true)} style={[styles.actionButton, { backgroundColor: colors.green500 }]}>
            <Ionicons name="car-outline" size={15} color={colors.white} />
            <Text style={styles.actionTextLight}>Am mașină</Text>
          </AnimatedPressable>
          <AnimatedPressable onPress={toggleRequest} style={[styles.actionButton, { backgroundColor: theme.surfaceMuted }]}>
            <Ionicons name="hand-left-outline" size={15} color={theme.textPrimary} />
            <Text style={[styles.actionText, { color: theme.textPrimary }]}>Caut transport</Text>
          </AnimatedPressable>
        </View>
        <CarpoolOfferModal
          visible={offerModalOpen}
          seats={seatsDraft}
          note={noteDraft}
          onSeatsChange={setSeatsDraft}
          onNoteChange={setNoteDraft}
          onCancel={() => setOfferModalOpen(false)}
          onSubmit={handleSubmitOffer}
        />
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>CARPOOLING</Text>

      {offers.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: theme.textPrimary }]}>🚗 Șoferi</Text>
          {offers.map((offer) => {
            const profile = profileLookup(offer.driverId);
            return (
              <View key={offer.driverId} style={styles.row}>
                <Avatar uri={profile.avatarUrl} name={profile.name} size={30} fontSize={12} />
                <Text style={[styles.rowText, { color: theme.textPrimary }]} numberOfLines={1}>
                  {profile.name} · {offer.seatsAvailable} {offer.seatsAvailable === 1 ? 'loc' : 'locuri'}
                  {offer.note ? ` — ${offer.note}` : ''}
                </Text>
              </View>
            );
          })}
        </>
      )}

      {requests.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: theme.textPrimary }]}>🙋 Caută transport</Text>
          {requests.map((request) => {
            const profile = profileLookup(request.userId);
            return (
              <View key={request.userId} style={styles.row}>
                <Avatar uri={profile.avatarUrl} name={profile.name} size={30} fontSize={12} />
                <Text style={[styles.rowText, { color: theme.textPrimary }]} numberOfLines={1}>{profile.name}</Text>
              </View>
            );
          })}
        </>
      )}

      <View style={styles.actionsRow}>
        <AnimatedPressable
          onPress={() => (myOffer ? handleRemoveOffer() : setOfferModalOpen(true))}
          style={[styles.actionButton, myOffer ? { backgroundColor: theme.surfaceMuted } : { backgroundColor: colors.green500 }]}
        >
          <Ionicons name="car-outline" size={15} color={myOffer ? theme.textPrimary : colors.white} />
          <Text style={myOffer ? [styles.actionText, { color: theme.textPrimary }] : styles.actionTextLight}>
            {myOffer ? 'Anulează oferta' : 'Am mașină'}
          </Text>
        </AnimatedPressable>
        <AnimatedPressable onPress={toggleRequest} style={[styles.actionButton, { backgroundColor: theme.surfaceMuted }]}>
          <Ionicons name="hand-left-outline" size={15} color={theme.textPrimary} />
          <Text style={[styles.actionText, { color: theme.textPrimary }]}>{myRequest ? 'Anulează cererea' : 'Caut transport'}</Text>
        </AnimatedPressable>
      </View>

      <CarpoolOfferModal
        visible={offerModalOpen}
        seats={seatsDraft}
        note={noteDraft}
        onSeatsChange={setSeatsDraft}
        onNoteChange={setNoteDraft}
        onCancel={() => setOfferModalOpen(false)}
        onSubmit={handleSubmitOffer}
      />
    </View>
  );
}

function CarpoolOfferModal({
  visible,
  seats,
  note,
  onSeatsChange,
  onNoteChange,
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  seats: string;
  note: string;
  onSeatsChange: (v: string) => void;
  onNoteChange: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const { colors: theme } = useAppTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.modalBackdrop} onPress={onCancel}>
        <Pressable style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Am mașină</Text>
          <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Locuri disponibile</Text>
          <TextInput
            value={seats}
            onChangeText={onSeatsChange}
            keyboardType="number-pad"
            style={[styles.modalInput, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}
          />
          <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Notă (opțional)</Text>
          <TextInput
            value={note}
            onChangeText={onNoteChange}
            placeholder="Ex: Plec din centru la 20:00"
            placeholderTextColor={theme.textSecondary}
            style={[styles.modalInput, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}
          />
          <Pressable onPress={onSubmit} style={[styles.modalSave, { backgroundColor: colors.green500 }]}>
            <Text style={styles.modalSaveText}>Salvează</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 8 },
  cardLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  sectionLabel: { fontSize: 12, fontWeight: '800', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  rowText: { flex: 1, fontSize: 12, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 12 },
  actionText: { fontSize: 12, fontWeight: '800' },
  actionTextLight: { color: colors.white, fontSize: 12, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', maxWidth: 340, borderRadius: 20, borderWidth: 1, padding: spacing.xl, gap: 6 },
  modalTitle: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  modalLabel: { fontSize: 11, fontWeight: '700', marginTop: 6 },
  modalInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  modalSave: { minHeight: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  modalSaveText: { color: colors.white, fontSize: 13, fontWeight: '800' },
});
