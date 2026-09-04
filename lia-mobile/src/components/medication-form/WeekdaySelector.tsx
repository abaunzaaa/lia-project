import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppText from '../AppText';
import { useAccessibility } from '../../context/AccessibilityContext';
import { Radius, Space } from '../../theme/tokens';
import {
  ALL_WEEKDAYS,
  WEEKDAY_LABEL,
  WEEKDAY_LETTER,
  WEEKDAYS,
  Weekday,
} from '../../utils/medicationFormHelpers';
import { useMedicationFormColors } from './useMedicationFormColors';

type Props = {
  value: Weekday[];
  onChange: (next: Weekday[]) => void;
  error?: string;
};

export default function WeekdaySelector({ value, onChange, error }: Props) {
  const { minTouch, scaleSpacing, scaleFont } = useAccessibility();
  const palette = useMedicationFormColors();
  const allSelected = WEEKDAYS.every((day) => value.includes(day));

  const toggle = (day: Weekday) => {
    if (value.includes(day)) {
      onChange(value.filter((item) => item !== day));
      return;
    }
    onChange(WEEKDAYS.filter((item) => item === day || value.includes(item)));
  };

  return (
    <View>
      <View style={styles.row}>
        {WEEKDAYS.map((day) => {
          const selected = value.includes(day);
          return (
            <Pressable
              key={day}
              onPress={() => toggle(day)}
              accessibilityRole="button"
              accessibilityLabel={`${WEEKDAY_LABEL[day]}${selected ? ', seleccionado' : ''}`}
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.day,
                {
                  minWidth: Math.max(40, minTouch - 8),
                  minHeight: Math.max(48, minTouch),
                  backgroundColor: selected ? palette.ice : palette.card,
                  borderColor: selected ? palette.navy : palette.border,
                  borderWidth: selected || palette.isHighContrast ? 2 : 1,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <AppText
                variant="body"
                style={{ color: palette.navy, fontWeight: '700', fontSize: scaleFont(15) }}
              >
                {WEEKDAY_LETTER[day]}
              </AppText>
              {selected ? (
                <Ionicons name="checkmark" size={12} color={palette.navy} />
              ) : (
                <View style={{ height: 12 }} />
              )}
            </Pressable>
          );
        })}
      </View>
      <Pressable
        onPress={() => onChange(allSelected ? [] : [...ALL_WEEKDAYS])}
        accessibilityRole="button"
        accessibilityLabel="Todos los días"
        style={{ minHeight: 48, justifyContent: 'center', marginTop: scaleSpacing(Space[4]) }}
      >
        <AppText variant="body" style={{ color: palette.navyMain, fontWeight: '600' }}>
          Todos los días
        </AppText>
      </Pressable>
      {error ? (
        <AppText variant="caption" style={{ color: palette.coral, marginTop: 4 }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  day: {
    flex: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 8,
  },
});
