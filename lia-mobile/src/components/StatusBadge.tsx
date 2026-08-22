import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Space } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { DoseStatus } from '../types';
import AppText from './AppText';

const CONFIG: Record<
  DoseStatus,
  { label: string; icon: keyof typeof Ionicons.glyphMap; prefix: string }
> = {
  pending: { label: 'Pendiente', icon: 'time-outline', prefix: '⏳' },
  taken: { label: 'Tomado', icon: 'checkmark', prefix: '✓' },
  skipped: { label: 'Omitido', icon: 'ellipse-outline', prefix: '○' },
  missed: { label: 'Sin registrar', icon: 'alert-circle-outline', prefix: '○' },
};

interface StatusBadgeProps {
  status: DoseStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { colors, isHighContrast } = useTheme();
  const { scaleFont, scaleSpacing } = useAccessibility();
  const config = CONFIG[status];

  const color =
    status === 'taken'
      ? colors.taken
      : status === 'skipped'
        ? colors.missed
        : status === 'missed'
          ? colors.pending
          : colors.pending;

  const soft =
    status === 'taken'
      ? colors.successSoft
      : status === 'skipped'
        ? colors.errorSoft
        : colors.accentSoft;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: isHighContrast ? colors.surface : soft,
          borderWidth: isHighContrast ? 2 : 0,
          borderColor: colors.border,
          paddingHorizontal: scaleSpacing(Space[8]),
          paddingVertical: scaleSpacing(Space[4]),
          gap: scaleSpacing(Space[4]),
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={config.label}
    >
      <Ionicons name={config.icon} size={scaleFont(14)} color={color} />
      <AppText variant="caption" style={{ color, fontWeight: '600', flexShrink: 1 }}>
        {isHighContrast ? `${config.prefix} ${config.label}` : config.label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
});
