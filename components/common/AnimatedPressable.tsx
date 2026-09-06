import { PropsWithChildren, useRef } from 'react';
import { Animated, GestureResponderEvent, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

type Props = PropsWithChildren<PressableProps & { style?: StyleProp<ViewStyle> }>;

export function AnimatedPressable({ children, style, onPressIn, onPressOut, ...rest }: Props) {
  const press = useRef(new Animated.Value(0)).current;

  const handlePressIn = (e: GestureResponderEvent) => {
    // low friction lets it overshoot past the target and wobble back — a jelly squash.
    Animated.spring(press, { toValue: 1, useNativeDriver: true, friction: 3.5, tension: 250 }).start();
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    Animated.spring(press, { toValue: 0, useNativeDriver: true, friction: 3, tension: 200 }).start();
    onPressOut?.(e);
  };

  const scaleX = press.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const scaleY = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] });

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} {...rest}>
      <Animated.View style={[style, { transform: [{ scaleX }, { scaleY }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
