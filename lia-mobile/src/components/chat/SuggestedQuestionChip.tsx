import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAccessibility } from '../../context/AccessibilityContext';
import { BrandColors, brandInk } from '../../theme/brand';
import { FontFamily, FontWeight, Layout, Space } from '../../theme/tokens';
import AppText from '../AppText';
import { CHAT_HAIRLINE } from './chatAssets';

type Props = {
  question: string;
  onPress: () => void;
  disabled?: boolean;
};

export default function SuggestedQuestionChip({ question, onPress, disabled }: Props) {
  const { colors, isDark, isHighContrast } = useTheme();
  const { minTouch, scaleSpacing, scaleFont } = useAccessibility();
  const lightChrome = !isDark && !isHighContrast;
  const ink = brandInk(isDark, isHighContrast, colors.textPrimary);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={question}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.chip,
        {
          minHeight: minTouch,
          paddingHorizontal: scaleSpacing(Space[16]),
          paddingVertical: scaleSpacing(Space[8]),
          backgroundColor: lightChrome ? BrandColors.white : colors.surface,
          borderColor: lightChrome ? CHAT_HAIRLINE : colors.border,
          borderWidth: isHighContrast ? 2 : 1,
          opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
        },
      ]}
    >
      <AppText
        variant="label"
        style={{
          color: ink,
          fontFamily: FontFamily.medium,
          fontWeight: FontWeight.medium,
          fontSize: scaleFont(16),
          lineHeight: scaleFont(22),
          flexShrink: 1,
        }}
      >
        {question}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: 26,
    justifyContent: 'center',
    minHeight: Layout.minTouchTarget,
  },
});
