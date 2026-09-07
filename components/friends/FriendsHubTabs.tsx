import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';

type HubTab = 'friends' | 'messages';

export function FriendsHubTabs({ active }: { active: HubTab }) {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <AnimatedPressable
        onPress={() => {
          if (active === 'friends') return;
          light();
          router.push('/friends');
        }}
        style={[styles.tab, active === 'friends' && { backgroundColor: colors.green500 }]}
        accessibilityLabel="Prieteni"
      >
        <Ionicons
          name={active === 'friends' ? 'people' : 'people-outline'}
          size={22}
          color={active === 'friends' ? colors.white : theme.textSecondary}
        />
      </AnimatedPressable>
      <AnimatedPressable
        onPress={() => {
          if (active === 'messages') return;
          light();
          router.push('/messages');
        }}
        style={[styles.tab, active === 'messages' && { backgroundColor: colors.green500 }]}
        accessibilityLabel="Mesaje"
      >
        <Ionicons
          name={active === 'messages' ? 'chatbubbles' : 'chatbubbles-outline'}
          size={22}
          color={active === 'messages' ? colors.white : theme.textSecondary}
        />
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '90%',
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.md,
    padding: 4,
    borderWidth: 1,
    borderRadius: 16,
  },
  tab: {
    flex: 1,
    minWidth: 48,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginHorizontal: 2,
  },
});
