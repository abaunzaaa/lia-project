import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppText from '../AppText';
import { useAccessibility } from '../../context/AccessibilityContext';
import { Radius, Space } from '../../theme/tokens';
import { presentationAssets } from '../../utils/medicationFormAssets';
import {
  MealRelation,
  MedicationPresentation,
  Weekday,
  formatShortDate,
  formatTimesPhrase,
  formatWeekdaysPhrase,
  mealLabel,
  presentationLabel,
} from '../../utils/medicationFormHelpers';
import { useMedicationFormColors } from './useMedicationFormColors';

type Props = {
  name: string;
  presentation: MedicationPresentation | null;
  dosePreview: string;
  weekdays?: Weekday[];
  times?: string[];
  mealRelation?: MealRelation | null;
  startDate?: string;
  endDate?: string | null;
  instructions?: string;
  reminderEnabled?: boolean;
  stockLabel?: string;
  compact?: boolean;
};

export default function MedicationSummaryCard({
  name,
  presentation,
  dosePreview,
  weekdays,
  times,
  mealRelation,
  startDate,
  endDate,
  instructions,
  reminderEnabled,
  stockLabel,
  compact,
}: Props) {
  const { scaleSpacing, scaleFont } = useAccessibility();
  const palette = useMedicationFormColors();
  const image = presentation ? presentationAssets[presentation] : null;
  const presentationText = [presentationLabel(presentation), dosePreview].filter(Boolean).join(' · ');
  const daysText = weekdays?.length ? formatWeekdaysPhrase(weekdays) : '';
  const timesText = times?.length ? formatTimesPhrase(times) : '';
  const mealText = mealLabel(mealRelation);
  const startText = startDate ? formatShortDate(startDate) : '';
  const endText = endDate ? formatShortDate(endDate) : 'Sin fecha de finalización';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.ice,
          borderColor: palette.border,
          borderWidth: palette.borderWidth,
          padding: scaleSpacing(Space[16]),
          gap: scaleSpacing(Space[8]),
        },
      ]}
    >
      <View style={styles.top}>
        {image ? (
          <Image
            source={image}
            style={[styles.art, { backgroundColor: 'transparent' }]}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={styles.art} />
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="h3" numberOfLines={2} style={{ color: palette.navy, fontWeight: '700' }}>
            {name || 'Medicamento'}
          </AppText>
          {presentationText ? (
            <AppText variant="body" style={{ color: palette.secondary, marginTop: 4 }}>
              {presentationText}
            </AppText>
          ) : null}
          {stockLabel ? (
            <AppText variant="caption" style={{ color: palette.navyMain, marginTop: 4, fontWeight: '600' }}>
              Te quedan {stockLabel}
            </AppText>
          ) : null}
        </View>
      </View>

      {compact ? null : (
        <>
          {daysText ? (
            <Row icon="calendar-outline" text={daysText} color={palette.navyMain} />
          ) : null}
          {timesText || mealText ? (
            <Row
              icon="time-outline"
              text={[timesText, mealText].filter(Boolean).join(' · ')}
              color={palette.navyMain}
            />
          ) : null}
          {startText ? (
            <AppText variant="caption" style={{ color: palette.secondary, fontSize: scaleFont(13) }}>
              Desde {startText} · {endText}
            </AppText>
          ) : null}
          {instructions ? (
            <AppText variant="caption" style={{ color: palette.secondary }}>
              {instructions}
            </AppText>
          ) : null}
          {reminderEnabled != null ? (
            <AppText variant="caption" style={{ color: palette.secondary }}>
              {reminderEnabled ? 'Recordatorio activado' : 'Sin recordatorio en el teléfono'}
            </AppText>
          ) : null}
        </>
      )}
    </View>
  );
}

function Row({ icon, text, color }: { icon: keyof typeof Ionicons.glyphMap; text: string; color: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={color} />
      <AppText variant="caption" style={{ color, flex: 1, flexShrink: 1, fontWeight: '600' }}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  art: {
    width: 72,
    height: 72,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
