import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

type MarkSize = 'sm' | 'md' | 'lg';

const BOX: Record<MarkSize, number> = {
  sm: 44,
  md: 72,
  lg: 104,
};

interface LiaMarkProps {
  size?: MarkSize;
}

/**
 * Isotipo LIA: una “L” construida con cápsula (medicamento)
 * y un punto de presencia (acompañamiento). Sin cruz médica.
 */
export default function LiaMark({ size = 'md' }: LiaMarkProps) {
  const { colors, isHighContrast } = useTheme();
  const box = BOX[size];
  const r = Math.round(box * 0.3);
  const stemW = Math.round(box * 0.145);
  const stemH = Math.round(box * 0.5);
  const footW = Math.round(box * 0.5);
  const footH = Math.round(box * 0.145);
  const pulse = Math.round(box * 0.175);
  const inset = Math.round(box * 0.26);

  const field = isHighContrast ? colors.surface : colors.primary;
  const figure = isHighContrast ? colors.textPrimary : colors.onPrimary;
  const companion = isHighContrast ? colors.textPrimary : colors.secondary;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Logotipo de LIA"
      style={[
        styles.field,
        {
          width: box,
          height: box,
          borderRadius: r,
          backgroundColor: field,
          borderWidth: isHighContrast ? 2 : 0,
          borderColor: colors.border,
        },
      ]}
    >
      <View
        style={{
          position: 'absolute',
          left: inset,
          top: Math.round(box * 0.22),
          width: stemW,
          height: stemH,
          borderRadius: stemW / 2,
          backgroundColor: figure,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: inset,
          bottom: Math.round(box * 0.2),
          width: footW,
          height: footH,
          borderRadius: footH / 2,
          backgroundColor: figure,
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: Math.round(box * 0.18),
          top: Math.round(box * 0.2),
          width: pulse,
          height: pulse,
          borderRadius: pulse / 2,
          backgroundColor: companion,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    overflow: 'hidden',
  },
});
