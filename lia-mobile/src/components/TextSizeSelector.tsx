import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
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
  const { colors, isHighContrast } = useTheme();
  const { textSize, setTextSize, minTouch, scaleSpacing } = useAccessibility();

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
                backgroundColor: selected ? colors.primary : colors.surface,
                borderWidth: isHighContrast || !selected ? 2 : 0,
                borderColor: selected ? colors.primary : colors.border,
              },
            ]}
          >
            <AppText
              variant="button"
              style={{
                color: selected ? colors.onPrimary : colors.textPrimary,
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
