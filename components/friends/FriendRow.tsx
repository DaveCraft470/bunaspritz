import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Avatar } from '@/components/common/Avatar';
import type { Profile } from '@/lib/social';
import type { Story } from '@/lib/stories';

export function FriendRow({
  friend,
  stories,
  goingOut = false,
  onAvatarPress,
  onProfilePress,
  onMessagePress,
  onMorePress,
}: {
  friend: Profile;
  stories: Story[];
  // "Cine iese?" — true while this friend has an active going-out status
  // (see lib/goingOut.ts); shown as a small badge next to their name.
  goingOut?: boolean;
  onAvatarPress: () => void;
  onProfilePress: () => void;
  onMessagePress: () => void;
  onMorePress?: () => void;
}) {
  const { colors: theme } = useAppTheme();
  const hasStory = stories.length > 0;

  return (
    <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <AnimatedPressable
        onPress={onAvatarPress}
        disabled={!hasStory}
        style={[styles.avatarButton, hasStory && styles.storyRing]}
        hitSlop={5}
      >
        <Avatar uri={friend.avatar_url} name={friend.name} size={44} fontSize={18} />
      </AnimatedPressable>
      <AnimatedPressable onPress={onProfilePress} style={styles.copy}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: theme.textPrimary }]} numberOfLines={1}>{friend.name}</Text>
          {goingOut && <Text style={styles.goingOutBadge}>🎉 Iese</Text>}
        </View>
        <Text style={[styles.username, { color: theme.textSecondary }]} numberOfLines={1}>@{friend.username}</Text>
      </AnimatedPressable>
      <AnimatedPressable onPress={onMessagePress} style={[styles.messageButton, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
        <Text style={[styles.messageText, { color: theme.accent }]}>Mesaj</Text>
      </AnimatedPressable>
      {onMorePress && (
        <AnimatedPressable onPress={onMorePress} hitSlop={8} style={styles.moreButton} accessibilityLabel="Mai multe opțiuni">
          <Ionicons name="ellipsis-horizontal" size={19} color={theme.textSecondary} />
        </AnimatedPressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 10, marginBottom: 10 },
  avatarButton: { borderRadius: 26, padding: 2 },
  storyRing: { borderWidth: 2, borderColor: colors.green500 },
  copy: { flex: 1, minWidth: 0, paddingVertical: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 14, fontWeight: '800' },
  goingOutBadge: { fontSize: 10, fontWeight: '800', color: colors.green600 },
  username: { fontSize: 11, marginTop: 2 },
  messageButton: { minHeight: 42, minWidth: 70, paddingHorizontal: 12, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  messageText: { fontSize: 11, fontWeight: '800' },
  moreButton: { padding: 5 },
});
