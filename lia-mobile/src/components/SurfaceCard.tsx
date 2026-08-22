import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Radius, Space } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';

type Variant = 'default' | 'emphasis' | 'quiet' | 'outline';

interface SurfaceCardProps {
  children: React.ReactNode;
  variant?: Variant;
  style?: ViewStyle;
}

export default function SurfaceCard({ children, variant = 'default', style }: SurfaceCardProps) {
  const { colors, shadows, isHighContrast } = useTheme();
  const { scaleSpacing } = useAccessibility();

  const backgrounds = {
    default: colors.surface,
    emphasis: colors.surfaceElevated,
    quiet: colors.primaryLight,
    outline: colors.surface,
  };

  return (
    <View
      style={[
        styles.base,
        variant === 'emphasis' ? shadows.md : variant === 'quiet' ? shadows.none : shadows.sm,
        {
          backgroundColor: backgrounds[variant],
          padding: scaleSpacing(Space[20]),
          borderRadius: Radius.lg,
          borderWidth: isHighContrast ? 2 : variant === 'outline' ? 1 : 0,
          borderColor: variant === 'emphasis' && !isHighContrast ? 'transparent' : colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
