import React from 'react';
import { View, Image, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors } from '../theme/brand';
import { FontFamily, FontWeight, Radius, Space } from '../theme/tokens';
import AppText from './AppText';

const SENIORS_IMAGE = require('../assets/images/lia-seniors.png');
const HOME_BLUE = '#D6E8F5';

const TITLE = 'Aún no tienes medicamentos';
const DESCRIPTION =
  'Cuando agregues el primero, LIA te ayudará a organizar cada toma con calma.';

type Props = {
  onAdd: () => void;
};

export default function EmptyMedicationsView({ onAdd }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, isHighContrast, isDark } = useTheme();
  const { scaleSpacing, scaleFont, minTouch } = useAccessibility();
  const { width, isTablet, isShortScreen } = useResponsive();
  const lightChrome = !isDark && !isHighContrast;

  const artWidth = Math.round(width * (isTablet ? 0.9 : isShortScreen ? 1.08 : 1.16));
  const sheetColor = lightChrome ? BrandColors.white : colors.surface;
  const circleSize = Math.round(width * 1.9);
  const capHeight = Math.round(width * 0.145);

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: lightChrome ? HOME_BLUE : colors.background,
        },
      ]}
    >
      <View
        style={[
          styles.hero,
          {
            paddingTop: insets.top,
            paddingBottom: 0,
          },
        ]}
      >
        <Image
          source={SENIORS_IMAGE}
          style={{
            width: artWidth,
            height: '100%',
            marginBottom: -Math.round(capHeight * 0.35),
          }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>

      <View style={[styles.sheetWrap, { marginTop: -Math.round(capHeight * 0.4) }]}>
        <View style={[styles.waveClip, { height: capHeight }]}>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: Math.round((width - circleSize) / 2),
              width: circleSize,
              height: circleSize,
              borderRadius: circleSize / 2,
              backgroundColor: sheetColor,
            }}
          />
        </View>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: sheetColor,
              paddingHorizontal: scaleSpacing(Space[24]),
              paddingTop: scaleSpacing(Space[20]),
              paddingBottom: scaleSpacing(Space[32]),
              borderColor: isHighContrast ? colors.border : 'transparent',
              borderWidth: isHighContrast ? 2 : 0,
            },
          ]}
        >
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={`${TITLE}. ${DESCRIPTION}`}
        >
          <AppText
            variant="h1"
            accessibilityRole="header"
            style={{
              color: lightChrome ? BrandColors.navy : colors.textPrimary,
              fontFamily: FontFamily.semiBold,
              fontWeight: FontWeight.semiBold,
              fontSize: scaleFont(26),
              lineHeight: scaleFont(32),
              letterSpacing: -0.2,
              textAlign: 'center',
            }}
          >
            {TITLE}
          </AppText>
          <AppText
            variant="body"
            style={{
              marginTop: scaleSpacing(Space[12]),
              color: lightChrome ? BrandColors.teal : colors.textSecondary,
              fontFamily: FontFamily.regular,
              fontWeight: FontWeight.regular,
              textAlign: 'center',
            }}
          >
            {DESCRIPTION}
          </AppText>
        </View>

        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel="Agregar medicamento"
          accessibilityHint="Abre el formulario para registrar un medicamento"
          style={({ pressed }) => [
            styles.addBtn,
            {
              minHeight: Math.min(minTouch, 40),
              marginTop: scaleSpacing(Space[24]),
              backgroundColor: lightChrome ? BrandColors.navy : colors.primary,
              borderWidth: isHighContrast ? 2 : 0,
              borderColor: colors.border,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
        >
          <AppText
            variant="button"
            numberOfLines={1}
            style={{
              color: BrandColors.white,
              fontFamily: FontFamily.semiBold,
              fontWeight: FontWeight.semiBold,
              textAlign: 'center',
            }}
          >
            Agregar medicamento
          </AppText>
        </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  sheetWrap: {
    width: '100%',
    overflow: 'visible',
    shadowColor: '#2F4156',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: -6,
    },
    elevation: 8,
  },
  waveClip: {
    width: '100%',
    overflow: 'hidden',
  },
  sheet: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  addBtn: {
    minWidth: 212,
    minHeight: 40,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
});
