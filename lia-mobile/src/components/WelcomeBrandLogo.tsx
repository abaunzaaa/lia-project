import React from 'react';
import { View, Image, StyleSheet, Platform } from 'react-native';
import { brandImages } from '../config/brandAssets';
import { BrandColors } from '../theme/brand';

interface WelcomeBrandLogoProps {
  pageBackground: string;
  size: number;
  /** Halo + sombra muy suave para protagonismo de marca (Login) */
  elevated?: boolean;
}

/**
 * Logo redondo de LIA — protagonista de marca.
 * Círculo completo, sin marco; wordmark centrado con margen interno.
 */
export default function WelcomeBrandLogo({
  pageBackground,
  size,
  elevated = false,
}: WelcomeBrandLogoProps) {
  const markW = size * 0.76;
  const markH = size * 0.5;
  const halo = size + (elevated ? 20 : 0);

  return (
    <View
      style={[
        styles.wrap,
        elevated && {
          width: halo,
          height: halo,
          borderRadius: halo / 2,
        },
      ]}
    >
      {elevated ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius: halo / 2,
              backgroundColor: BrandColors.skyBlue,
              opacity: 0.32,
            },
          ]}
        />
      ) : null}

      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel="Logotipo de LIA"
        style={[
          styles.clip,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: pageBackground,
          },
          elevated && styles.softShadow,
        ]}
      >
        <Image
          source={brandImages.logoRound}
          style={{ width: markW, height: markH }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  clip: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  softShadow: Platform.select({
    ios: {
      shadowColor: BrandColors.navy,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.1,
      shadowRadius: 14,
    },
    android: {
      elevation: 3,
    },
    default: {},
  }),
});
