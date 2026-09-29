import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { BrandColors } from '../../theme/brand';

type Props = {
  topOffset: number;
};

/** Curva decorativa de fondo. No intercepta toques. */
export default function IdentificationResultWave({ topOffset }: Props) {
  const { colors, isDark, isHighContrast } = useTheme();
  const fill = isHighContrast
    ? colors.surfaceElevated
    : isDark
      ? colors.primaryLight
      : BrandColors.skyBlue;

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: topOffset }]}>
      <View style={[styles.wave, { backgroundColor: fill }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 168,
    overflow: 'hidden',
    zIndex: 0,
  },
  wave: {
    position: 'absolute',
    left: '-18%',
    right: '-18%',
    top: 28,
    height: 200,
    borderBottomLeftRadius: 220,
    borderBottomRightRadius: 180,
  },
});
