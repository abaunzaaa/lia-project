import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { BrandColors } from '../theme/brand';
import { Radius, Space, Layout } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility, TextSize } from '../context/AccessibilityContext';
import AppText from './AppText';

const OPTIONS: { size: TextSize; label: string }[] = [
  { size: 'sm', label: 'A−' },
  { size: 'md', label: 'A' },
  { size: 'lg', label: 'A+' },
];

export default function TextSizeSelector() {
  const { colors, isHighContrast, isDark } = useTheme();
  const { textSize, setTextSize, minTouch, scaleSpacing } = useAccessibility();
  const lightChrome = !isDark && !isHighContrast;

  return (
    <View
      style={[styles.row, { gap: scaleSpacing(Space[8]) }]}
      accessibilityRole="adjustable"
      accessibilityLabel="Tamaño del texto"
    >
      {OPTIONS.map((opt, index) => {
        const selected = textSize === opt.size;
        return (
          <TouchableOpacity
            key={opt.size}
            onPress={() => setTextSize(opt.size)}
            accessibilityRole="button"
            accessibilityLabel={
              opt.size === 'sm' ? 'Texto pequeño' : opt.size === 'lg' ? 'Texto grande' : 'Texto normal'
            }
            accessibilityState={{ selected }}
            style={[
              styles.option,
              {
                minHeight: minTouch,
                minWidth: minTouch,
                backgroundColor: lightChrome
                  ? '#FFFFFF'
                  : selected
                    ? colors.primary
                    : colors.surface,
                borderWidth: selected || isHighContrast || lightChrome ? 1 : 0,
                borderColor: selected
                  ? lightChrome
                    ? BrandColors.navy
                    : colors.primary
                  : lightChrome
                    ? '#F0F1F2'
                    : colors.border,
              },
            ]}
          >
            <AppText
              variant="button"
              style={{
                color: selected
                  ? lightChrome
                    ? BrandColors.navy
                    : colors.onPrimary
                  : lightChrome
                    ? BrandColors.navy
                    : colors.textPrimary,
                fontSize: 14 + index * 4,
              }}
            >
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
    alignItems: 'center',
  },
  option: {
    flex: 1,
    maxWidth: 96,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Layout.minTouchTarget,
  },
});
