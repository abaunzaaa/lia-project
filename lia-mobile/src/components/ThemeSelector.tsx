import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandColors } from '../theme/brand';
import { Radius, Space, Layout } from '../theme/tokens';
import { Appearance } from '../theme/themes';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import AppText from './AppText';

type ThemeSelectorProps = {
  /** appearance = solo Claro | Noche; full = incluye Alto contraste */
  mode?: 'appearance' | 'full';
};

const APPEARANCE_OPTIONS: {
  value: 'light' | 'dark';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'light', label: 'Claro', icon: 'sunny-outline' },
  { value: 'dark', label: 'Noche', icon: 'moon-outline' },
];

const FULL_OPTIONS: {
  value: Appearance;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'light', label: 'Claro', icon: 'sunny-outline' },
  { value: 'dark', label: 'Noche', icon: 'moon-outline' },
  { value: 'highContrast', label: 'Alto contraste', icon: 'contrast-outline' },
];

export default function ThemeSelector({ mode = 'appearance' }: ThemeSelectorProps) {
  const { appearance, setAppearance, colors, isHighContrast, isDark } = useTheme();
  const { minTouch, scaleSpacing, scaleFont, isSeniorMode } = useAccessibility();
  const lightChrome = !isDark && !isHighContrast;

  const optionChrome = (selected: boolean) => ({
    minHeight: minTouch + 8,
    backgroundColor: lightChrome
      ? '#FFFFFF'
      : selected
        ? colors.primaryLight
        : colors.surface,
    borderWidth: selected || isHighContrast ? 2 : 1,
    borderColor: selected
      ? lightChrome
        ? BrandColors.navy
        : colors.primary
      : lightChrome
        ? '#F0F1F2'
        : colors.border,
    padding: scaleSpacing(Space[12]),
  });

  const iconColor = lightChrome ? '#202124' : colors.primary;

  if (mode === 'full') {
    return (
      <View style={[styles.row, isSeniorMode && styles.stack, { gap: scaleSpacing(Space[8]) }]}>
        {FULL_OPTIONS.map((opt) => {
          const selected = appearance === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setAppearance(opt.value)}
              accessibilityRole="button"
              accessibilityLabel={`Tema ${opt.label}`}
              accessibilityState={{ selected }}
              style={[
                styles.option,
                optionChrome(selected),
              ]}
            >
              <Ionicons name={opt.icon} size={scaleFont(20)} color={iconColor} />
              <AppText variant="caption" style={{ marginTop: 6, textAlign: 'center', flexShrink: 1 }}>
                {opt.label}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <View style={[styles.row, isSeniorMode && styles.stack, { gap: scaleSpacing(Space[8]) }]}>
      {APPEARANCE_OPTIONS.map((opt) => {
        const selected = appearance === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => setAppearance(opt.value)}
            accessibilityRole="button"
            accessibilityLabel={`Tema ${opt.label}`}
            accessibilityState={{ selected }}
            style={[
              styles.option,
              optionChrome(selected),
            ]}
          >
            <Ionicons name={opt.icon} size={scaleFont(20)} color={iconColor} />
              <AppText variant="caption" style={{ marginTop: 6, textAlign: 'center', flexShrink: 1 }}>
                {opt.label}
              </AppText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  stack: {
    flexDirection: 'column',
  },
  option: {
    flex: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Layout.minTouchTarget,
  },
});
