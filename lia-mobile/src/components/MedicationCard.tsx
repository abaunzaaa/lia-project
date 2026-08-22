import React from 'react';
import { View, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Space } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { BrandColors } from '../theme/brand';
import { formatScheduleTimes, formatTime } from '../utils/helpers';
import { Medication } from '../types';
import AppText from './AppText';
import SurfaceCard from './SurfaceCard';

interface MedicationCardProps {
  medication: Medication;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
}

const FREQUENCY_LABELS: Record<string, string> = {
  '8h': 'Cada 8 horas',
  '12h': 'Cada 12 horas',
  '24h': 'Todos los días',
  '2x': 'Dos veces al día',
  '3x': 'Tres veces al día',
  prn: 'Según necesidad',
};

export default function MedicationCard({
  medication,
  onPress,
  onEdit,
  onDelete,
  showActions = true,
}: MedicationCardProps) {
  const { colors, isHighContrast, isDark } = useTheme();
  const { minTouch, scaleSpacing, scaleFont } = useAccessibility();
  const frequency = medication.frequency
    ? FREQUENCY_LABELS[medication.frequency] || medication.frequency
    : '';
  const scheduleLabel =
    medication.schedules?.length > 0
      ? formatScheduleTimes(medication.schedules.map((s) => s.time))
      : medication.time
        ? formatTime(medication.time)
        : '';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`${medication.name}, ${medication.dose}.${frequency ? ` ${frequency}.` : ''}${scheduleLabel ? ` Horario ${scheduleLabel}` : ''}`}
      style={{ marginBottom: scaleSpacing(Space[12]), width: '100%', minWidth: 0 }}
    >
      <SurfaceCard variant="default" style={styles.card}>
        <View style={styles.header}>
          <View
            style={[
              styles.mark,
              {
                backgroundColor: isHighContrast
                  ? colors.textPrimary
                  : isDark
                    ? BrandColors.teal
                    : BrandColors.navy,
                marginRight: scaleSpacing(Space[12]),
              },
            ]}
          />
          <View style={styles.info}>
            <AppText variant="medicationName" style={{ flexShrink: 1 }} numberOfLines={2}>
              {medication.name}
            </AppText>
            <AppText variant="body" tone="secondary" style={{ marginTop: 4, flexShrink: 1 }}>
              {medication.dose}
            </AppText>
            {scheduleLabel ? (
              <AppText
                variant="caption"
                style={{
                  marginTop: scaleSpacing(Space[8]),
                  color: isHighContrast ? colors.textPrimary : BrandColors.teal,
                  fontWeight: '600',
                  flexShrink: 1,
                }}
              >
                {scheduleLabel}
              </AppText>
            ) : null}
            {frequency ? (
              <AppText variant="caption" tone="muted" style={{ marginTop: 4 }}>
                {frequency}
              </AppText>
            ) : null}
          </View>
          {showActions ? (
            <View style={styles.actions}>
              {onEdit ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation?.();
                    onEdit();
                  }}
                  style={{
                    minWidth: minTouch,
                    minHeight: minTouch,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  accessibilityLabel="Editar medicamento"
                  accessibilityRole="button"
                >
                  <Ionicons name="create-outline" size={scaleFont(22)} color={colors.primary} />
                </Pressable>
              ) : null}
              {onDelete ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation?.();
                    onDelete();
                  }}
                  style={{
                    minWidth: minTouch,
                    minHeight: minTouch,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  accessibilityLabel="Eliminar medicamento"
                  accessibilityRole="button"
                  accessibilityHint="Quita este medicamento de tu lista activa"
                >
                  <Ionicons name="trash-outline" size={scaleFont(22)} color={colors.error} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </SurfaceCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  mark: {
    width: 4,
    height: 52,
    borderRadius: Radius.full,
    marginTop: 2,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
});
