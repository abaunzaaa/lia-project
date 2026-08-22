import React, { useMemo } from 'react';
import { View, Image, StyleSheet, Text, Platform } from 'react-native';
import { BrandColors } from '../theme/brand';
import { brandImages } from '../config/brandAssets';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { FontWeight, Radius } from '../theme/tokens';

interface WelcomeHeroProps {
  height: number;
}

const FADE_STEPS = 28;

const SANS = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default: undefined,
});

/**
 * Hero de bienvenida: ilustración a sangrado completo y fundido al beige de marca.
 */
export default function WelcomeHero({ height }: WelcomeHeroProps) {
  const { isDark, isHighContrast } = useTheme();
  const { scaleFont } = useAccessibility();

  const pageFade = isHighContrast ? '#000000' : isDark ? '#10161C' : BrandColors.beige;
  const fadeHeight = Math.round(height * 0.28);

  const strips = useMemo(() => {
    return Array.from({ length: FADE_STEPS }, (_, i) => {
      const t = (i + 1) / FADE_STEPS;
      const eased = t * t * (3 - 2 * t);
      return {
        key: `fade-${i}`,
        opacity: isDark ? eased * 0.97 : eased,
      };
    });
  }, [isDark]);

  if (isHighContrast) {
    return <View style={[styles.shell, { height, backgroundColor: '#000000' }]} />;
  }

  return (
    <View style={[styles.shell, { height, backgroundColor: pageFade }]}>
      <Image
        source={brandImages.welcome}
        style={styles.photo}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
        accessible={false}
      />

      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isDark ? '#10161C' : BrandColors.skyBlue,
            opacity: isDark ? 0.28 : 0.04,
          },
        ]}
      />

      <View pointerEvents="none" style={[styles.fadeRail, { height: fadeHeight }]}>
        {strips.map((strip) => (
          <View
            key={strip.key}
            style={[styles.fadeStrip, { backgroundColor: pageFade, opacity: strip.opacity }]}
          />
        ))}
      </View>

      <View
        accessibilityRole="text"
        accessibilityLabel="Hoy, dos tomas"
        style={[
          styles.chip,
          {
            backgroundColor: isDark ? 'rgba(24, 32, 40, 0.92)' : 'rgba(255, 252, 250, 0.94)',
            borderColor: isDark ? 'rgba(200, 217, 230, 0.28)' : 'rgba(200, 217, 230, 0.9)',
            bottom: Math.round(height * 0.14),
          },
        ]}
      >
        <View style={[styles.chipDot, { backgroundColor: BrandColors.teal }]} />
        <Text
          maxFontSizeMultiplier={1.2}
          style={[
            styles.chipLabel,
            {
              color: isDark ? BrandColors.beige : BrandColors.navy,
              fontSize: scaleFont(12),
            },
          ]}
        >
          Hoy · 2 tomas
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    overflow: 'hidden',
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
  chip: {
    position: 'absolute',
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  chipLabel: {
    fontFamily: SANS,
    fontWeight: FontWeight.medium,
    letterSpacing: 0.2,
  },
});
