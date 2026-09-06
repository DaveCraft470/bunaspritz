import { useEffect, useRef } from 'react';
import { NativeSyntheticEvent, NativeScrollEvent, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';

export type WheelPickerOption<T extends string | number> = {
  label: string;
  value: T;
  disabled?: boolean;
};

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 3;
const VERTICAL_PADDING = (ITEM_HEIGHT * (VISIBLE_ITEMS - 1)) / 2;

export function WheelPicker<T extends string | number>({
  options,
  selectedValue,
  onValueChange,
  label,
}: {
  options: WheelPickerOption<T>[];
  selectedValue: T;
  onValueChange: (value: T) => void;
  label?: string;
}) {
  const { colors: theme } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === selectedValue));

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
  }, [selectedIndex]);

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.max(0, Math.min(options.length - 1, Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT)));
    const option = options[index];
    if (option && !option.disabled && option.value !== selectedValue) {
      onValueChange(option.value);
    } else if (option?.disabled) {
      scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: true });
    }
  }

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>}
      <View style={[styles.wheel, { borderColor: theme.border }]}>
        <View pointerEvents="none" style={[styles.selectionOverlay, { borderColor: colors.green500 }]} />
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          snapToAlignment="start"
          decelerationRate="fast"
          contentContainerStyle={{ paddingVertical: VERTICAL_PADDING }}
          onMomentumScrollEnd={handleScrollEnd}
          scrollEventThrottle={16}
        >
          {options.map((option) => {
            const selected = option.value === selectedValue;
            return (
              <AnimatedPressable
                key={String(option.value)}
                disabled={option.disabled}
                onPress={() => {
                  if (!option.disabled) onValueChange(option.value);
                }}
                style={styles.option}
              >
                <Text
                  style={[
                    styles.optionText,
                    {
                      color: option.disabled
                        ? theme.border
                        : selected
                          ? theme.textPrimary
                          : theme.textSecondary,
                      opacity: selected ? 1 : 0.55,
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

export { ITEM_HEIGHT };

const styles = StyleSheet.create({
  container: { flex: 1, minWidth: 0 },
  label: { textAlign: 'center', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginBottom: spacing.xs },
  wheel: { height: ITEM_HEIGHT * VISIBLE_ITEMS, borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  selectionOverlay: {
    position: 'absolute',
    zIndex: 1,
    top: VERTICAL_PADDING,
    left: 5,
    right: 5,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderRadius: 8,
  },
  option: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  optionText: { fontSize: 17, fontWeight: '800' },
});
