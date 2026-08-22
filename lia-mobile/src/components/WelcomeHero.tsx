import React, { useMemo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { BrandColors } from '../theme/brand';
import { brandImages } from '../config/brandAssets';
import { useTheme } from '../context/ThemeContext';

interface WelcomeHeroProps {
  height: number;
}

const FADE_STEPS = 36;

/**
 * Hero full-bleed: foto protagonista + fade continuo (sin bandas) hacia el fondo.
 */
export default function WelcomeHero({ height }: WelcomeHeroProps) {
  const { isDark, isHighContrast } = useTheme();

  const pageFade = isHighContrast ? '#000000' : isDark ? '#10161C' : BrandColors.beige;
  /** Fade un poco más profundo para hero más alto */
  const fadeHeight = Math.round(height * 0.4);

  const strips = useMemo(() => {
    return Array.from({ length: FADE_STEPS }, (_, i) => {
      const t = (i + 1) / FADE_STEPS;
      // smoothstep: transición continua, sin escalones perceptibles
      const eased = t * t * (3 - 2 * t);
      return {
        key: `fade-${i}`,
        opacity: isDark ? eased * 0.98 : eased,
      };
    });
  }, [isDark]);

  return (
    <View style={[styles.shell, { height }]}>
      <Image
        source={brandImages.welcome}
        style={[
          styles.photo,
          {
            transform: [{ scale: 1.06 }, { translateY: Math.round(height * 0.02) }],
          },
        ]}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
        accessible={false}
      />

      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isHighContrast ? '#000000' : BrandColors.skyBlue,
            opacity: isHighContrast ? 0.38 : isDark ? 0.16 : 0.05,
          },
        ]}
      />

      {!isHighContrast && (
        <View pointerEvents="none" style={[styles.fadeRail, { height: fadeHeight }]}>
          {strips.map((strip) => (
            <View
              key={strip.key}
              style={[styles.fadeStrip, { backgroundColor: pageFade, opacity: strip.opacity }]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: BrandColors.skyBlue,
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  fadeRail: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
  fadeStrip: {
    width: '100%',
    flex: 1,
  },
});
