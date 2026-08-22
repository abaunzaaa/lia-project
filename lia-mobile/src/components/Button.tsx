import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { FontFamily, FontWeight, Layout, Radius, TypeRole } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'quiet';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  icon,
  style,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const { colors, isHighContrast } = useTheme();
  const { scaleFont, buttonScale, minTouch } = useAccessibility();

  const vertical = { sm: 10, md: 14, lg: 16 }[size] * buttonScale;
  const fontSize = scaleFont(size === 'sm' ? 15 : TypeRole.button.size);

  const backgrounds = {
    primary: colors.primary,
    secondary: isHighContrast ? colors.surface : colors.accentSoft,
    outline: 'transparent',
    ghost: 'transparent',
    quiet: colors.surfaceElevated,
  };

  const foregrounds = {
    primary: colors.onPrimary,
    secondary: isHighContrast ? colors.textPrimary : colors.primaryDark,
    outline: colors.primary,
    ghost: colors.textSecondary,
    quiet: colors.textPrimary,
  };

  const borderWidth =
    variant === 'outline' || variant === 'quiet' || (isHighContrast && variant !== 'ghost')
      ? isHighContrast
        ? 2
        : variant === 'quiet'
          ? 1
          : 2
      : 0;
  const borderColor =
    variant === 'quiet'
      ? colors.border
      : variant === 'primary' && isHighContrast
        ? colors.border
        : variant === 'outline' || variant === 'secondary'
          ? colors.primary
          : 'transparent';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        styles.base,
        {
          paddingVertical: vertical,
          paddingHorizontal: 16,
          minHeight: Math.max(minTouch, 52 * buttonScale),
          backgroundColor: backgrounds[variant],
          borderWidth,
          borderColor,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <>
          <ActivityIndicator color={foregrounds[variant]} />
          <Text
            style={[
              styles.label,
              {
                fontSize,
                color: foregrounds[variant],
              },
            ]}
          >
            {title}
          </Text>
        </>
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.label,
              {
                fontSize,
                color: foregrounds[variant],
              },
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    gap: 8,
    minHeight: Layout.minTouchTarget,
    /** Sin width:100% fijo — evita overflow en filas flex */
    maxWidth: '100%',
    minWidth: 0,
    flexShrink: 1,
    alignSelf: 'stretch',
  },
  label: {
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
    textAlign: 'center',
    flexShrink: 1,
    minWidth: 0,
  },
});
