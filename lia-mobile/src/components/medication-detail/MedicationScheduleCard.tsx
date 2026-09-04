import React from 'react';
import { View, Image, StyleSheet, ImageSourcePropType } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAccessibility } from '../../context/AccessibilityContext';
import { BrandColors, brandAccent, brandInk, liaCardBorder } from '../../theme/brand';
import { FontFamily, FontWeight, Space } from '../../theme/tokens';
import AppText from '../AppText';
import { DETAIL_CARD_RADIUS, DETAIL_CLOCK_SIZE, DETAIL_HAIRLINE } from './medicationDetailAssets';

type Props = {
  scheduleLabel: string;
  clockSource: ImageSourcePropType | null;
};

export default function MedicationScheduleCard({ scheduleLabel, clockSource }: Props) {
  const { colors, shadows, isDark, isHighContrast } = useTheme();
  const { scaleSpacing } = useAccessibility();
  const lightChrome = !isDark && !isHighContrast;
  const ink = brandInk(isDark, isHighContrast, colors.textPrimary);
  const accent = brandAccent(isDark, isHighContrast, colors.primary, colors.textPrimary);
  const clockSize = Math.min(58, Math.max(50, scaleSpacing(DETAIL_CLOCK_SIZE)));

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Horarios, ${scheduleLabel}`}
      style={[
        styles.card,
        !isHighContrast ? shadows.sm : null,
        {
          backgroundColor: lightChrome ? BrandColors.white : colors.surface,
          borderColor: lightChrome ? DETAIL_HAIRLINE : liaCardBorder(lightChrome, colors.border),
          borderWidth: isHighContrast ? 2 : 1,
          paddingVertical: scaleSpacing(Space[12]),
          paddingHorizontal: scaleSpacing(Space[16]),
        },
      ]}
    >
      {clockSource ? (
        <View
          style={[styles.clock, { width: clockSize, height: clockSize }]}
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Image
            source={clockSource}
            style={{ width: clockSize, height: clockSize, backgroundColor: 'transparent' }}
            resizeMode="contain"
            accessible={false}
            accessibilityIgnoresInvertColors
          />
        </View>
      ) : null}

      <View style={styles.copy}>
        <AppText
          variant="overline"
          style={{
            color: accent,
            marginBottom: scaleSpacing(Space[4]),
          }}
        >
          Horarios
        </AppText>
        <AppText
          variant="h2"
          style={{
            color: ink,
            fontFamily: FontFamily.semiBold,
            fontWeight: FontWeight.semiBold,
            flexShrink: 1,
          }}
        >
          {scheduleLabel}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: DETAIL_CARD_RADIUS,
    overflow: 'visible',
    gap: 12,
  },
  clock: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
});
