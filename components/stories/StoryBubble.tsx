import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Avatar } from '@/components/common/Avatar';
import type { Story } from '@/lib/stories';

export function StoryBubble({
  story,
  label,
  isOwn = false,
  viewed = false,
  onPress,
  onAdd,
}: {
  story?: Story;
  label: string;
  isOwn?: boolean;
  viewed?: boolean;
  onPress?: () => void;
  onAdd?: () => void;
}) {
  return (
    <AnimatedPressable onPress={isOwn && !story ? onAdd : onPress} style={styles.container}>
      <View style={[styles.ring, { borderColor: story && !viewed ? colors.green500 : '#B8C8BE' }]}> 
        {story ? (
          <Avatar uri={story.authorAvatarUri} name={story.authorName ?? label} size={56} fontSize={21} />
        ) : (
          <View style={styles.addAvatar}>
            <Ionicons name="add" size={25} color={colors.green600} />
          </View>
        )}
        {isOwn && story && <View style={styles.ownDot}><Ionicons name="add" size={11} color={colors.white} /></View>}
      </View>
      <Text numberOfLines={1} style={styles.label}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: { width: 72, alignItems: 'center', gap: 5 },
  ring: { width: 64, height: 64, borderRadius: 32, borderWidth: 2.5, padding: 2, alignItems: 'center', justifyContent: 'center' },
  addAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.green50, alignItems: 'center', justifyContent: 'center' },
  ownDot: { position: 'absolute', right: -1, bottom: -1, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.green500, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.ink, fontSize: 11, fontWeight: '700', maxWidth: 68 },
});
