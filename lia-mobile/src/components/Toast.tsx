import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Radius, Space } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import AppText from './AppText';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  visible: boolean;
  onHide: () => void;
  duration?: number;
}

export default function Toast({
  message,
  type = 'info',
  visible,
  onHide,
  duration = 3000,
}: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const { colors, shadows } = useTheme();
  const { scaleSpacing } = useAccessibility();

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.delay(duration),
        Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start(() => onHide());
    }
  }, [visible]);

  if (!visible) return null;

  const accent = type === 'success' ? colors.success : type === 'error' ? colors.error : colors.info;
  const prefix = type === 'success' ? '✓ ' : type === 'error' ? '' : '';

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        styles.container,
        shadows.md,
        {
          opacity,
          backgroundColor: colors.surfaceElevated,
          borderLeftColor: accent,
          left: scaleSpacing(Space[20]),
          right: scaleSpacing(Space[20]),
          padding: scaleSpacing(Space[16]),
        },
      ]}
    >
      <AppText variant="body">{prefix}{message}</AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    borderRadius: Radius.md,
    borderLeftWidth: 4,
    zIndex: 9999,
  },
});
