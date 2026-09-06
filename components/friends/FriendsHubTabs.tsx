import { Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { colors, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';

type HubTab = 'friends' | 'messages';

const TABS: { key: HubTab; route: '/friends' | '/messages'; icon: 'people-outline' | 'chatbox-outline' }[] = [
  { key: 'friends', route: '/friends', icon: 'people-outline' },
  { key: 'messages', route: '/messages', icon: 'chatbox-outline' },
];

export function FriendsHubTabs({ active }: { active: HubTab }) {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <AnimatedPressable
            key={tab.key}
            onPress={() => {
              if (isActive) return;
              light();
              router.push(tab.route);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.key === 'friends' ? 'Prieteni' : 'Mesaje'}
            style={[
              styles.tab,
              isActive
                ? {
                    backgroundColor: colors.green500,
                    borderColor: colors.green500,
                    shadowColor: colors.green500,
                    shadowOpacity: 0.45,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 6,
                  }
                : {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
            ]}
          >
            <Ionicons
              name={tab.icon}
              size={26}
              color={isActive ? colors.white : theme.textSecondary}
            />
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const GAP_BETWEEN_TABS = 16;
const TAB_WIDTH_PERCENT = '45%' as const;
const TAB_HEIGHT = 64;
const TAB_HORIZONTAL_PADDING = 32;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: spacing.lg,
  },
  tab: {
    width: TAB_WIDTH_PERCENT,
    height: TAB_HEIGHT,
    marginHorizontal: GAP_BETWEEN_TABS / 2,
    paddingHorizontal: TAB_HORIZONTAL_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.22,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
  },
});
