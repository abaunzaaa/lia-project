import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AppText from '../AppText';
import SelectableImageCard from './SelectableImageCard';
import { useAccessibility } from '../../context/AccessibilityContext';
import { Space } from '../../theme/tokens';
import { mealAssets } from '../../utils/medicationFormAssets';
import { MealRelation } from '../../utils/medicationFormHelpers';
import { useMedicationFormColors } from './useMedicationFormColors';

type Props = {
  value: MealRelation | null;
  onChange: (next: MealRelation | null) => void;
};

const MEAL_CARDS: { id: MealRelation; label: string; fullLabel: string }[] = [
  { id: 'before_meal', label: 'Antes', fullLabel: 'Antes de comer' },
  { id: 'after_meal', label: 'Después', fullLabel: 'Después de comer' },
  { id: 'with_meal', label: 'Con comida', fullLabel: 'Con la comida' },
];

export default function MealRelationSelector({ value, onChange }: Props) {
  const { scaleSpacing, minTouch } = useAccessibility();
  const palette = useMedicationFormColors();

  return (
    <View>
      <View style={[styles.row, { gap: scaleSpacing(Space[8]) }]}>
        {MEAL_CARDS.map((option) => (
          <SelectableImageCard
            key={option.id}
            label={option.label}
            image={mealAssets[option.id]}
            selected={value === option.id}
            onPress={() => onChange(value === option.id ? null : option.id)}
            accessibilityLabel={`${option.fullLabel}${value === option.id ? ', seleccionado' : ''}`}
            compact
          />
        ))}
      </View>
      <Pressable
        onPress={() => onChange(null)}
        accessibilityRole="button"
        accessibilityLabel="No aplica"
        accessibilityState={{ selected: value == null }}
        style={{ minHeight: Math.max(44, minTouch), justifyContent: 'center' }}
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
});
