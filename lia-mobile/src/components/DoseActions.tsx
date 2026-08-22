import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Space } from '../theme/tokens';
import { useAccessibility } from '../context/AccessibilityContext';
import { useResponsive } from '../hooks/useResponsive';
import Button from './Button';

interface DoseActionsProps {
  onTaken: () => void;
  onMissed: () => void;
  takenLabel?: string;
  missedLabel?: string;
  disabled?: boolean;
  loading?: boolean;
}

/**
 * Acciones Tomado / Omitir — misma altura tipográfica, touch ≥48.
 * Fila cuando hay espacio; columna en small phone, A+, senior o fuente grande.
 */
export default function DoseActions({
  onTaken,
  onMissed,
  takenLabel = 'Tomado',
  missedLabel = 'Omitir',
  disabled = false,
  loading = false,
}: DoseActionsProps) {
  const { scaleSpacing, isSeniorMode, fontScale, minTouch } = useAccessibility();
  const { isSmallPhone, compact, width } = useResponsive();

  const stack =
    isSeniorMode ||
    isSmallPhone ||
    compact ||
    fontScale >= 1.2 ||
    width < 390;

  const busy = disabled || loading;
  const btnMin = Math.max(48, minTouch);

  return (
    <View
      style={[
        styles.row,
        {
          gap: scaleSpacing(Space[8]),
          marginTop: scaleSpacing(Space[12]),
        },
        stack && styles.stack,
      ]}
    >
      <Button
        title={loading ? 'Guardando…' : takenLabel}
        onPress={onTaken}
        size="md"
        style={[styles.flexBtn, { minHeight: btnMin }]}
        disabled={busy}
        loading={loading}
        accessibilityLabel="Marcar toma como realizada"
        accessibilityHint="Registra que ya tomaste este medicamento"
      />
      <Button
        title={missedLabel}
        variant="outline"
        size="md"
        onPress={onMissed}
        style={[styles.flexBtn, { minHeight: btnMin }]}
        disabled={busy}
        accessibilityLabel="Omitir esta toma"
        accessibilityHint="Registra que no tomaste este medicamento ahora"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    width: '100%',
    maxWidth: '100%',
  },
  stack: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
  },
  flexBtn: {
    flex: 1,
    minWidth: 0,
    maxWidth: '100%',
    alignSelf: 'stretch',
    flexShrink: 1,
  },
});
