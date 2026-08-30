import React from 'react';
import { View, Pressable, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DrugSearchResult } from '../types';
import { BrandColors, liaCardBorder } from '../theme/brand';
import { Radius, Space } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { detectDrugForm, presentDrugName } from '../utils/drugReferenceLabels';
import AppText from './AppText';

const FORM_IMAGES = {
  tableta: require('../assets/images/forma-tableta.png'),
  capsula: require('../assets/images/forma-capsula.png'),
  jarabe: require('../assets/images/forma-jarabe.png'),
  inyeccion: require('../assets/images/forma-inyeccion.png'),
  gotas: require('../assets/images/forma-gotas.png'),
  crema: require('../assets/images/forma-crema.png'),
  otro: require('../assets/images/forma-otro.png'),
} as const;

type Props = {
  item: DrugSearchResult;
  onPress: () => void;
  disabled?: boolean;
  directMatch?: boolean;
};

export default function DrugMatchCard({
  item,
  onPress,
  disabled = false,
  directMatch = false,
}: Props) {
  const { colors, isHighContrast, isDark, shadows } = useTheme();
  const { scaleSpacing, scaleFont, minTouch } = useAccessibility();
  const lightChrome = !isDark && !isHighContrast;

  const name = presentDrugName(item.displayName) || presentDrugName(item.name);
  if (!name) return null;

  const form = detectDrugForm(name, item.tty);
  const ink = lightChrome ? BrandColors.navy : colors.textPrimary;
  const muted = lightChrome ? BrandColors.teal : colors.textSecondary;
  const thumbBg = isHighContrast
    ? colors.surface
    : isDark
      ? colors.accentSoft
      : '#EEF4F8';
  const chevronBg = isHighContrast
    ? colors.surface
    : isDark
      ? colors.primary
      : BrandColors.navy;
  const chevronFg = isHighContrast ? colors.textPrimary : BrandColors.white;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${form.label}`}
      accessibilityHint="Ver información de este medicamento"
      style={({ pressed }) => [
        styles.card,
        shadows.sm,
        {
          minHeight: Math.max(minTouch + 12, 76),
          backgroundColor: lightChrome ? BrandColors.white : colors.surface,
          borderColor: liaCardBorder(lightChrome, colors.border),
          borderWidth: isHighContrast ? 2 : 1,
          paddingVertical: scaleSpacing(Space[12]),
          paddingHorizontal: scaleSpacing(Space[12]),
          marginBottom: scaleSpacing(Space[12]),
          opacity: pressed ? 0.94 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.thumb,
          {
            backgroundColor: thumbBg,
            borderWidth: isHighContrast ? 1 : 0,
            borderColor: colors.border,
          },
        ]}
      >
        <Image
          source={FORM_IMAGES[form.key]}
          style={styles.thumbImage}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>

      <View style={styles.copy}>
        <AppText
          variant="h3"
          style={{
            color: ink,
            flexShrink: 1,
            fontSize: scaleFont(16),
            lineHeight: scaleFont(22),
          }}
          numberOfLines={2}
        >
          {name}
        </AppText>
        <AppText
          variant="caption"
          style={{
            color: muted,
            marginTop: 2,
            flexShrink: 1,
          }}
          numberOfLines={1}
        >
          {form.label}
        </AppText>
        {directMatch ? (
          <AppText
            variant="caption"
            style={{
              color: muted,
              marginTop: 2,
              flexShrink: 1,
            }}
          >
            + Coincidencia directa
          </AppText>
        ) : null}
      </View>

      <View
        style={[
          styles.chevron,
          {
            width: 36,
            height: 36,
            backgroundColor: chevronBg,
            borderWidth: isHighContrast ? 2 : 0,
            borderColor: colors.border,
          },
        ]}
      >
        <Ionicons
          name="chevron-forward"
          size={scaleFont(18)}
          color={chevronFg}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    gap: 12,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  thumbImage: {
    width: 46,
    height: 46,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  chevron: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
