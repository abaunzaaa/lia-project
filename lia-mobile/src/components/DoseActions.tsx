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
 * Acciones Tomado / Omitir — compactas visualmente, zona de toque ampliada con hitSlop.
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
  const visualHeight = isSeniorMode ? Math.max(44, Math.min(minTouch, 48)) : 40;

  return (
    <View
      style={[
        styles.row,
        {
          gap: scaleSpacing(Space[8]),
          marginTop: scaleSpacing(Space[8]),
        },
        stack && styles.stack,
      ]}
    >
      <Button
        title={loading ? 'Guardando…' : takenLabel}
        onPress={onTaken}
        size="md"
        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        style={[
          styles.compactBtn,
          { minHeight: visualHeight, paddingVertical: 6, paddingHorizontal: 12 },
        ]}
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
        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        style={[
          styles.compactBtn,
          { minHeight: visualHeight, paddingVertical: 6, paddingHorizontal: 12 },
        ]}
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
    flexWrap: 'nowrap',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  stack: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
    alignItems: 'stretch',
    alignSelf: 'stretch',
  },
  compactBtn: {
    flexGrow: 0,
    flexShrink: 1,
    alignSelf: 'flex-start',
  },
});
