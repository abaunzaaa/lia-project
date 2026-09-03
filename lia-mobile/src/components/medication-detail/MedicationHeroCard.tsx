import React from 'react';
import { View, Image, StyleSheet, ImageSourcePropType } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAccessibility } from '../../context/AccessibilityContext';
import { brandAccent, brandInk } from '../../theme/brand';
import { FontFamily, FontWeight, Space } from '../../theme/tokens';
import AppText from '../AppText';
import EditorialText from '../EditorialText';
import { DETAIL_HERO_RADIUS } from './medicationDetailAssets';

type Props = {
  name: string;
  dosage: string;
  minHeight: number;
  artSource: ImageSourcePropType | null;
  overlapFooter?: boolean;
};

export default function MedicationHeroCard({
  name,
  dosage,
  minHeight,
  artSource,
  overlapFooter = false,
}: Props) {
  const { colors, isDark, isHighContrast } = useTheme();
  const { scaleFont, scaleSpacing } = useAccessibility();
  const ink = brandInk(isDark, isHighContrast, colors.textPrimary);
  const accent = brandAccent(isDark, isHighContrast, colors.primary, colors.textPrimary);
  const nameSize = scaleFont(28);

  return (
    <View
      accessible
      accessibilityLabel={[name, dosage].filter(Boolean).join(', ')}
      style={[
        styles.hero,
        {
          minHeight,
          backgroundColor: isHighContrast ? colors.surfaceElevated : colors.accentSoft,
          borderColor: isHighContrast ? colors.border : 'transparent',
          borderWidth: isHighContrast ? 2 : 0,
        },
      ]}
    >
      <View
        style={[
          styles.heroContent,
          {
            gap: scaleSpacing(12),
            paddingHorizontal: scaleSpacing(Space[20]),
            paddingVertical: scaleSpacing(18),
            minHeight: Math.max(150, minHeight - (overlapFooter ? 22 : 0)),
          },
        ]}
      >
        <View style={styles.copy}>
          <EditorialText
            variant="headline"
            textBreakStrategy="simple"
            android_hyphenationFrequency="none"
            style={{
              color: ink,
              width: '100%',
              fontSize: nameSize,
              lineHeight: Math.round(nameSize * 1.22),
              fontFamily: FontFamily.semiBold,
              fontWeight: FontWeight.semiBold,
            }}
          >
            {name}
          </EditorialText>
          {dosage ? (
            <AppText
              variant="bodyLarge"
              style={{
                color: accent,
                fontSize: scaleFont(20),
                lineHeight: scaleFont(26),
                marginTop: scaleSpacing(Space[4]),
                width: '100%',
              }}
            >
              {dosage}
            </AppText>
          ) : null}
        </View>

        {artSource ? (
          <View
            style={styles.heroImageContainer}
            pointerEvents="none"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Image
              source={artSource}
              style={styles.heroImage}
              resizeMode="contain"
              accessible={false}
              accessibilityIgnoresInvertColors
            />
          </View>
        ) : null}
      </View>
      {overlapFooter ? <View style={styles.overlapSpacer} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderTopLeftRadius: DETAIL_HERO_RADIUS,
    borderTopRightRadius: DETAIL_HERO_RADIUS,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    width: '100%',
  },
  copy: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  heroImageContainer: {
    width: '31%',
    maxWidth: 128,
    minWidth: 108,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  heroImage: {
    width: 118,
    maxWidth: 128,
    height: undefined,
    maxHeight: 100,
    aspectRatio: 1448 / 1086,
    backgroundColor: 'transparent',
  },
  overlapSpacer: {
    height: 22,
  },
});
