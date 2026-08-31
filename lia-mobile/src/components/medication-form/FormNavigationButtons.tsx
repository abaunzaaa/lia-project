import React from 'react';
import { View } from 'react-native';
import Button from '../Button';
import { useAccessibility } from '../../context/AccessibilityContext';
import { Radius, Space } from '../../theme/tokens';
import { useMedicationFormColors } from './useMedicationFormColors';

type Props = {
  primaryTitle: string;
  secondaryTitle: string;
  onPrimary: () => void;
  onSecondary: () => void;
  primaryDisabled?: boolean;
  loading?: boolean;
};

export default function FormNavigationButtons({
  primaryTitle,
  secondaryTitle,
  onPrimary,
  onSecondary,
  primaryDisabled,
  loading,
}: Props) {
  const { minTouch, scaleSpacing } = useAccessibility();
  const palette = useMedicationFormColors();

  return (
    <View style={{ gap: scaleSpacing(Space[8]) }}>
      <Button
        title={primaryTitle}
        onPress={onPrimary}
        loading={loading}
        disabled={primaryDisabled || loading}
        style={{
          minHeight: Math.max(52, minTouch),
          borderRadius: Radius.lg,
          backgroundColor: palette.navyMain,
        }}
      />
      <Button
        title={secondaryTitle}
        variant="outline"
        onPress={onSecondary}
        disabled={loading}
        style={{
          minHeight: Math.max(52, minTouch),
          borderRadius: Radius.lg,
          borderColor: palette.navy,
        }}
      />
    </View>
  );
}
