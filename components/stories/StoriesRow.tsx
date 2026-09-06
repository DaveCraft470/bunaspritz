import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { StoryBubble } from '@/components/stories/StoryBubble';
import type { Story } from '@/lib/stories';

export type StoryGroup = {
  userId: string;
  label: string;
  avatarUri?: string | null;
  stories: Story[];
};

export function StoriesRow({
  stories,
  currentUserId,
  onOpen,
  onAdd,
  title = 'Stories',
  compact = false,
}: {
  stories: Story[];
  currentUserId?: string;
  onOpen: (group: StoryGroup, index?: number) => void;
  onAdd?: () => void;
  title?: string;
  compact?: boolean;
}) {
  const { colors: theme } = useAppTheme();
  const groups = useMemo(() => {
    const grouped = new Map<string, StoryGroup>();
    [...stories]
      .sort((a, b) => Number(a.viewers.includes(currentUserId ?? '')) - Number(b.viewers.includes(currentUserId ?? '')) || b.createdAt.localeCompare(a.createdAt))
      .forEach((story) => {
        const existing = grouped.get(story.userId);
        if (existing) existing.stories.push(story);
        else grouped.set(story.userId, { userId: story.userId, label: story.authorName ?? 'Utilizator', avatarUri: story.authorAvatarUri, stories: [story] });
      });
    return [...grouped.values()];
  }, [currentUserId, stories]);

  return (
    <View style={[styles.section, compact && styles.compactSection]}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {onAdd && (
          <StoryBubble label="Adaugă" isOwn onAdd={onAdd} />
        )}
        {groups.map((group) => (
          <StoryBubble
            key={group.userId}
            story={group.stories[0]}
            label={group.label}
            viewed={group.stories.every((story) => story.viewers.includes(currentUserId ?? ''))}
            onPress={() => onOpen(group)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  compactSection: { paddingTop: spacing.sm },
  title: { fontSize: 16, fontWeight: '800', marginBottom: 9 },
  row: { gap: 10, paddingRight: spacing.lg },
});
