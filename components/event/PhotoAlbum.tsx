import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { showAlert } from '@/lib/alert';
import { alertPermissionDenied } from '@/lib/permissions';
import { extensionAndTypeForImage } from '@/lib/media';
import { deleteEventPhoto, getEventPhotos, getSignedEventPhotoUrl, uploadEventPhoto, type EventPhoto } from '@/lib/eventPhotos';
import { ReportModal } from '@/components/social/ReportModal';
import { EVENT_PHOTO_REPORT_REASONS } from '@/lib/reports';

function Thumb({ photo, onPress }: { photo: EventPhoto; onPress: () => void }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getSignedEventPhotoUrl(photo.path).then((signed) => {
      if (!cancelled) setUri(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [photo.path]);

  return (
    <Pressable onPress={onPress} style={styles.thumbWrap}>
      {uri ? <Image source={{ uri }} style={styles.thumb} resizeMode="cover" /> : <View style={[styles.thumb, styles.thumbLoading]}><ActivityIndicator size="small" /></View>}
    </Pressable>
  );
}

// A persistent, shared gallery for the event — distinct from ephemeral
// stories and the private checkin-photos proof (see the migration). Any
// attendee can add photos; the uploader or the event host can remove one.
export function PhotoAlbum({
  eventId,
  canUpload,
  isHost,
  currentUserId,
}: {
  eventId: string;
  canUpload: boolean;
  isHost: boolean;
  currentUserId: string | undefined;
}) {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState<EventPhoto | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  function load() {
    setLoading(true);
    getEventPhotos(eventId)
      .then(setPhotos)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    if (!viewerPhoto) {
      setViewerUri(null);
      return;
    }
    let cancelled = false;
    getSignedEventPhotoUrl(viewerPhoto.path).then((signed) => {
      if (!cancelled) setViewerUri(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [viewerPhoto]);

  async function handleUpload() {
    if (!canUpload || !currentUserId || uploading) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alertPermissionDenied(permission.canAskAgain, 'Activează accesul la poze din Setările telefonului ca să poți adăuga o poză în album.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const { extension, contentType } = extensionAndTypeForImage(asset);

    light();
    setUploading(true);
    const uploaded = await uploadEventPhoto(eventId, currentUserId, asset.uri, extension, contentType);
    setUploading(false);
    if (uploaded) {
      setPhotos((current) => [uploaded, ...current]);
    } else {
      showAlert('A apărut o eroare', 'Nu am putut încărca poza. Încearcă din nou.');
    }
  }

  async function handleDelete(photo: EventPhoto) {
    const ok = await deleteEventPhoto(photo.id, photo.path);
    if (ok) {
      setPhotos((current) => current.filter((p) => p.id !== photo.id));
      setViewerPhoto(null);
    } else {
      showAlert('A apărut o eroare', 'Nu am putut șterge poza. Încearcă din nou.');
    }
  }

  const canDeleteViewerPhoto = !!viewerPhoto && (viewerPhoto.uploaderId === currentUserId || isHost);

  if (!canUpload && !loading && photos.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>ALBUM FOTO</Text>
        {canUpload && (
          <Pressable onPress={handleUpload} disabled={uploading} style={styles.uploadButton} accessibilityLabel="Adaugă o poză">
            {uploading ? <ActivityIndicator size="small" color={colors.green500} /> : <Ionicons name="add-circle" size={22} color={colors.green500} />}
          </Pressable>
        )}
      </View>
      {loading ? (
        <ActivityIndicator color={colors.green500} style={{ marginVertical: spacing.md }} />
      ) : photos.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Nicio poză încă. Fii primul care adaugă una!</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.grid}>
          {photos.map((photo) => (
            <Thumb key={photo.id} photo={photo} onPress={() => setViewerPhoto(photo)} />
          ))}
        </ScrollView>
      )}

      <Modal visible={!!viewerPhoto} transparent animationType="fade" onRequestClose={() => setViewerPhoto(null)}>
        <View style={styles.viewerBackdrop}>
          <Pressable style={styles.viewerClose} onPress={() => setViewerPhoto(null)} hitSlop={10}>
            <Ionicons name="close" size={26} color={colors.white} />
          </Pressable>
          {viewerUri ? (
            <Image source={{ uri: viewerUri }} style={styles.viewerImage} resizeMode="contain" />
          ) : (
            <ActivityIndicator color={colors.white} />
          )}
          <View style={styles.viewerActions}>
            {canDeleteViewerPhoto && (
              <Pressable onPress={() => viewerPhoto && handleDelete(viewerPhoto)} style={styles.viewerActionButton}>
                <Ionicons name="trash-outline" size={16} color={colors.white} />
                <Text style={styles.viewerActionText}>Șterge</Text>
              </Pressable>
            )}
            <Pressable onPress={() => setReportOpen(true)} style={styles.viewerActionButton}>
              <Ionicons name="flag-outline" size={16} color={colors.white} />
              <Text style={styles.viewerActionText}>Raportează</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {viewerPhoto && currentUserId && (
        <ReportModal
          visible={reportOpen}
          targetType="event_photo"
          targetId={viewerPhoto.id}
          targetLabel="poză din album"
          reasons={EVENT_PHOTO_REPORT_REASONS}
          reporterId={currentUserId}
          reporterLabel=""
          onClose={() => setReportOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  uploadButton: { padding: 2 },
  emptyText: { fontSize: 12, fontStyle: 'italic', paddingVertical: 6 },
  grid: { gap: 8, paddingTop: 2 },
  thumbWrap: { width: 84, height: 84, borderRadius: 12, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  thumbLoading: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.05)' },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
  viewerClose: { position: 'absolute', top: 50, right: 20, zIndex: 2 },
  viewerImage: { width: '100%', height: '75%' },
  viewerActions: { flexDirection: 'row', gap: 20, marginTop: 24 },
  viewerActionButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  viewerActionText: { color: colors.white, fontSize: 13, fontWeight: '700' },
});
