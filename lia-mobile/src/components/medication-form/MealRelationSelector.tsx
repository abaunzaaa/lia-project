import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AppText from '../AppText';
import SelectableImageCard from './SelectableImageCard';
import { useAccessibility } from '../../context/AccessibilityContext';
import { Space } from '../../theme/tokens';
import { mealAssets } from '../../utils/medicationFormAssets';
import { MEAL_OPTIONS, MealRelation } from '../../utils/medicationFormHelpers';
import { useMedicationFormColors } from './useMedicationFormColors';

type Props = {
  value: MealRelation | null;
  onChange: (next: MealRelation | null) => void;
};

export default function MealRelationSelector({ value, onChange }: Props) {
  const { scaleSpacing, minTouch } = useAccessibility();
  const palette = useMedicationFormColors();

  return (
    <View>
      <View style={[styles.row, { gap: scaleSpacing(Space[8]) }]}>
        {MEAL_OPTIONS.map((option) => (
          <View key={option.id} style={styles.cell}>
            <SelectableImageCard
              label={option.label}
              image={mealAssets[option.id]}
              selected={value === option.id}
              onPress={() => onChange(value === option.id ? null : option.id)}
              accessibilityLabel={`${option.label}${value === option.id ? ', seleccionado' : ''}`}
              fill
            />
          </View>
        ))}
      </View>
      <Pressable
        onPress={() => onChange(null)}
        accessibilityRole="button"
        accessibilityLabel="No aplica"
        accessibilityState={{ selected: value == null }}
        style={{ minHeight: Math.max(48, minTouch), justifyContent: 'center' }}
      >
        <AppText variant="body" style={{ color: palette.navyMain, fontWeight: '600' }}>
          No aplica
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
});
