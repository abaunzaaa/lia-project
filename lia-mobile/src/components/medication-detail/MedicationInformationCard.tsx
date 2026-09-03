import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAccessibility } from '../../context/AccessibilityContext';
import { BrandColors, brandAccent, brandInk, liaCardBorder } from '../../theme/brand';
import { FontFamily, FontWeight, Layout, Space } from '../../theme/tokens';
import AppText from '../AppText';
import { DETAIL_HAIRLINE, DETAIL_INFO_RADIUS } from './medicationDetailAssets';

export type MedicationInfoRow = {
  key: string;
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

type Props = {
  rows: MedicationInfoRow[];
};

export default function MedicationInformationCard({ rows }: Props) {
  const { colors, isDark, isHighContrast } = useTheme();
  const { scaleFont, scaleSpacing, minTouch } = useAccessibility();
  const lightChrome = !isDark && !isHighContrast;
  const ink = brandInk(isDark, isHighContrast, colors.textPrimary);
  const accent = brandAccent(isDark, isHighContrast, colors.primary, colors.textPrimary);
  const divider = lightChrome ? DETAIL_HAIRLINE : colors.border;

  if (rows.length === 0) return null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: lightChrome ? BrandColors.white : colors.surface,
          borderColor: lightChrome ? DETAIL_HAIRLINE : liaCardBorder(lightChrome, colors.border),
          borderWidth: isHighContrast ? 2 : 1,
        },
      ]}
    >
      {rows.map((row, index) => (
        <View
          key={row.key}
          accessibilityRole="text"
          accessibilityLabel={`${row.label}, ${row.value}`}
          style={[
            styles.row,
            {
              minHeight: minTouch,
              paddingVertical: scaleSpacing(Space[12]),
              paddingHorizontal: scaleSpacing(Space[16]),
              borderBottomWidth: index < rows.length - 1 ? StyleSheet.hairlineWidth : 0,
              borderBottomColor: divider,
            },
          ]}
        >
          <Ionicons
            name={row.icon}
            size={scaleFont(22)}
            color={accent}
            accessible={false}
          />
          <View style={styles.copy}>
            <AppText variant="caption" style={{ color: accent, marginBottom: 2 }}>
              {row.label}
            </AppText>
            <AppText
              variant="body"
              style={{
                color: ink,
                fontFamily: FontFamily.semiBold,
                fontWeight: FontWeight.semiBold,
                flexShrink: 1,
              }}
            >
              {row.value}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: DETAIL_INFO_RADIUS,
    overflow: 'hidden',
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: Layout.minTouchTarget,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
});
