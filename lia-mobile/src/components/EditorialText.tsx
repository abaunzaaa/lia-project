import React from 'react';
import { Text, TextProps, StyleSheet, Platform } from 'react-native';
import { FontWeight } from '../theme/tokens';
import { BrandColors } from '../theme/brand';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';

type EditorialVariant = 'display' | 'headline' | 'subhead';

const VARIANTS: Record<
  EditorialVariant,
  { size: number; lineHeight: number; weight: '400' | '700'; letterSpacing: number }
> = {
  display: { size: 38, lineHeight: 44, weight: '400', letterSpacing: -0.5 },
  headline: { size: 34, lineHeight: 40, weight: '400', letterSpacing: -0.4 },
  subhead: { size: 26, lineHeight: 32, weight: '400', letterSpacing: -0.2 },
};

/**
 * Serif editorial de alto contraste.
 * iOS: Times New Roman (Didot/Bodoni-like).
 * Android: serif genérica del sistema.
 */
const SERIF = Platform.select({
  ios: 'Times New Roman',
  android: 'serif',
  default: 'serif',
});

interface EditorialTextProps extends TextProps {
  variant?: EditorialVariant;
  children: React.ReactNode;
  accent?: boolean;
}

export default function EditorialText({
  variant = 'headline',
  children,
  style,
  accent = false,
  ...rest
}: EditorialTextProps) {
  const { isDark, isHighContrast } = useTheme();
  const { scaleFont } = useAccessibility();
  const role = VARIANTS[variant];

  const color = isHighContrast
    ? '#FFFFFF'
    : accent
      ? BrandColors.teal
      : isDark
        ? BrandColors.beige
        : BrandColors.navy;

  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={1.35}
      style={[
        styles.base,
        {
          fontFamily: SERIF,
          fontSize: scaleFont(role.size),
          lineHeight: scaleFont(role.lineHeight),
          fontWeight: role.weight,
          letterSpacing: role.letterSpacing,
          color,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontStyle: 'normal',
  },
});
