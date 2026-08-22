import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { brandImages } from '../config/brandAssets';
import { useTheme } from '../context/ThemeContext';

interface WelcomeBrandLogoProps {
  /** Conservado por compatibilidad; el wordmark ya trae el fondo de marca. */
  pageBackground?: string;
  /** Ancho visual del wordmark. */
  size: number;
  elevated?: boolean;
}

/**
 * Wordmark LIA — sin círculo, sin halo, sin recuadro.
 * El PNG usa el beige/oscuro de la pantalla para que se integre.
 */
export default function WelcomeBrandLogo({ size }: WelcomeBrandLogoProps) {
  const { isDark, isHighContrast } = useTheme();
  const source =
    isDark || isHighContrast ? brandImages.logoWordmarkDark : brandImages.logoWordmark;
  const height = Math.round(size * 0.36);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Logotipo de LIA"
      style={[styles.wrap, { width: size, height }]}
    >
      <Image
        source={source}
        style={styles.mark}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  mark: {
    width: '100%',
    height: '100%',
  },
});
