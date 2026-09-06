import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '@/constants/theme';
import { Avatar } from '@/components/common/Avatar';
import { useStories } from '@/contexts/StoriesContext';
import type { Story } from '@/lib/stories';

export function StoryViewer({
  visible,
  stories,
  initialIndex = 0,
  currentUserId,
  onClose,
  onEventPress,
}: {
  visible: boolean;
  stories: Story[];
  initialIndex?: number;
  currentUserId?: string;
  onClose: () => void;
  onEventPress?: (eventId: string) => void;
}) {
  const { markViewed, remove } = useStories();
  const [index, setIndex] = useState(initialIndex);
  const story = stories[index];
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (visible) {
      setIndex(Math.min(initialIndex, Math.max(0, stories.length - 1)));
      setPaused(false);
    }
  }, [initialIndex, stories.length, visible]);

  useEffect(() => {
    if (!visible || !story) return;
    markViewed(story.id);
  }, [markViewed, story, visible]);

  useEffect(() => {
    if (!visible || paused || stories.length <= 1) return;
    const timer = setTimeout(() => {
      if (index >= stories.length - 1) onClose();
      else setIndex((current) => current + 1);
    }, 6000);
    return () => clearTimeout(timer);
  }, [index, onClose, paused, stories.length, visible]);

  if (!story) return null;

  function confirmDelete() {
    if (story.userId !== currentUserId) return;
    Alert.alert('Ștergi acest Story?', 'Acțiunea nu poate fi anulată.', [
      { text: 'Anulează', style: 'cancel' },
      {
        text: 'Șterge',
        style: 'destructive',
        onPress: () => {
          remove(story.id);
          if (stories.length <= 1) onClose();
          else setIndex((current) => Math.min(current, stories.length - 2));
        },
      },
    ]);
  }

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Image source={{ uri: story.mediaUri }} style={styles.media} resizeMode="cover" />
        <View style={styles.scrim} pointerEvents="none" />
        <View style={styles.top}>
          <View style={styles.progressRow}>
            {stories.map((item, itemIndex) => (
              <View key={item.id} style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: itemIndex <= index ? '100%' : '0%' }]} />
              </View>
            ))}
          </View>
          <View style={styles.header}>
            <Avatar uri={story.authorAvatarUri} name={story.authorName ?? 'Utilizator'} size={38} fontSize={15} />
            <View style={styles.headerCopy}>
              <Text style={styles.author}>{story.authorName ?? 'Utilizator'}</Text>
              <Text style={styles.time}>{formatRelativeTime(story.createdAt)}</Text>
            </View>
            {story.userId === currentUserId && (
              <Pressable onPress={confirmDelete} hitSlop={10} accessibilityLabel="Șterge Story">
                <Ionicons name="ellipsis-horizontal" size={22} color={colors.white} />
              </Pressable>
            )}
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Închide Story">
              <Ionicons name="close" size={26} color={colors.white} />
            </Pressable>
          </View>
        </View>

        <Pressable style={styles.leftZone} onPress={() => setIndex((current) => Math.max(0, current - 1))} onPressIn={() => setPaused(true)} onPressOut={() => setPaused(false)} />
        <Pressable style={styles.rightZone} onPress={() => (index >= stories.length - 1 ? onClose() : setIndex((current) => current + 1))} onPressIn={() => setPaused(true)} onPressOut={() => setPaused(false)} />

        <View style={styles.bottom} pointerEvents="box-none">
          {!!story.text && <Text style={styles.storyText}>{story.text}</Text>}
          {story.eventId && (
            <Pressable onPress={() => onEventPress?.(story.eventId!)} style={styles.eventPill}>
              <Ionicons name="calendar-outline" size={16} color={colors.white} />
              <Text style={styles.eventText}>Vezi evenimentul</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

function formatRelativeTime(iso: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0D0F' },
  media: { ...StyleSheet.absoluteFill, width: undefined, height: undefined },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.28)' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: spacing.md, paddingTop: spacing.lg },
  progressRow: { flexDirection: 'row', gap: 4 },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.35)' },
  progressFill: { height: '100%', backgroundColor: colors.white },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  headerCopy: { flex: 1 },
  author: { color: colors.white, fontSize: 14, fontWeight: '800' },
  time: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },
  leftZone: { position: 'absolute', top: 100, bottom: 100, left: 0, width: '38%' },
  rightZone: { position: 'absolute', top: 100, bottom: 100, right: 0, width: '62%' },
  bottom: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.xxxl, alignItems: 'center', gap: 12 },
  storyText: { color: colors.white, fontSize: 19, fontWeight: '700', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 6 },
  eventPill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  eventText: { color: colors.white, fontSize: 12, fontWeight: '800' },
});
