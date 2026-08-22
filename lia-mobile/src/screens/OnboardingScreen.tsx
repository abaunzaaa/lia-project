import React, { useMemo } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types';
import { WelcomeHero, WelcomeBrandLogo } from '../components';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors } from '../theme/brand';
import { Radius, Space, FontWeight } from '../theme/tokens';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;
};

const SERIF = Platform.select({
  ios: 'Times New Roman',
  android: 'serif',
  default: 'serif',
});

const SANS = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: undefined,
});

const SANS_MEDIUM = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default: undefined,
});

export default function OnboardingScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { isDark, isHighContrast } = useTheme();
  const { scaleSpacing, minTouch, scaleFont, buttonScale, isSeniorMode } = useAccessibility();
  const { height, horizontalPadding, compact, isTablet, isShortScreen } = useResponsive();

  const bg = isHighContrast ? '#000000' : isDark ? '#10161C' : BrandColors.beige;
  const titleColor = isHighContrast ? BrandColors.white : isDark ? BrandColors.beige : BrandColors.navy;
  const bodyColor = isHighContrast ? '#D0D0D0' : isDark ? BrandColors.skyBlue : BrandColors.teal;
  const secondaryColor = isHighContrast
    ? BrandColors.white
    : isDark
      ? BrandColors.skyBlue
      : BrandColors.navy;

  const topBreath = useMemo(() => {
    if (isShortScreen || compact) return 8;
    if (isTablet) return 16;
    if (insets.top >= 50) return 14;
    return 12;
  }, [compact, isShortScreen, isTablet, insets.top]);

  const topBand = insets.top + topBreath;

  /** Hero en el medio: TEXT arriba → IMAGE → LOGO → botones */
  const heroHeight = useMemo(() => {
    const endRatio = isShortScreen || compact ? 0.34 : isTablet ? 0.36 : 0.38;
    const raw = Math.round(height * endRatio);
    const floor = isShortScreen ? 180 : compact ? 200 : 220;
    const cap = isTablet ? 340 : isShortScreen ? 240 : 300;
    return Math.round(Math.min(Math.max(raw, floor), cap));
  }, [height, compact, isTablet, isShortScreen]);

  /** Logo ~+25% vs 124 → ~155 estándar, perfectamente redondo */
  const logoSize = isTablet ? 175 : isSeniorMode ? (compact ? 140 : 160) : compact ? 136 : 155;

  const titleSize = scaleFont(compact || isShortScreen ? 20 : isTablet ? 24 : 22);
  const titleLine = scaleFont(compact || isShortScreen ? 26 : isTablet ? 30 : 28);
  const bodySize = scaleFont(compact ? 13 : 14);
  const bodyLine = scaleFont(compact ? 18 : 20);

  const primaryH = Math.max(minTouch, Math.round((compact ? 46 : 48) * buttonScale));
  const secondaryH = Math.max(minTouch, Math.round((compact ? 42 : 44) * buttonScale));

  const needsScroll = (isSeniorMode && isShortScreen) || height < 640;

  const content = (
    <View
      style={[
        styles.column,
        {
          paddingBottom: Math.max(insets.bottom, scaleSpacing(compact ? Space[8] : Space[12])),
          minHeight: needsScroll ? undefined : height,
        },
      ]}
    >
      <View style={{ height: topBand, backgroundColor: bg }} />

      <View
        style={[
          styles.copyBlock,
          {
            paddingHorizontal: horizontalPadding,
            marginBottom: scaleSpacing(compact ? Space[12] : Space[16]),
          },
        ]}
      >
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={1.35}
          style={[
            styles.title,
            {
              color: titleColor,
              fontSize: titleSize,
              lineHeight: titleLine,
              marginBottom: scaleSpacing(Space[8]),
            },
          ]}
        >
          Tu compañía para cuidar tus medicamentos cada día
        </Text>

        <Text
          maxFontSizeMultiplier={1.35}
          style={[
            styles.body,
            {
              color: bodyColor,
              fontSize: bodySize,
              lineHeight: bodyLine,
              opacity: isHighContrast ? 1 : 0.9,
            },
          ]}
        >
          LIA te ayuda a recordar tus horarios, identificar tus medicamentos y llevar un registro
          sencillo de tus tomas, paso a paso.
        </Text>
      </View>

      <WelcomeHero height={heroHeight} />

      <View
        style={[
          styles.bodyPad,
          {
            paddingHorizontal: horizontalPadding,
            marginTop: scaleSpacing(compact ? Space[12] : Space[16]),
          },
        ]}
      >
        <View
          style={[
            styles.logoBlock,
            {
              minHeight: logoSize,
              marginBottom: scaleSpacing(compact ? Space[16] : Space[20]),
            },
          ]}
        >
          <WelcomeBrandLogo pageBackground={bg} size={logoSize} />
        </View>

        {!needsScroll && <View style={[styles.flexSpacer, compact && styles.flexSpacerTight]} />}

        <View
          style={[
            styles.actions,
            {
              gap: scaleSpacing(Space[4]),
              marginTop: needsScroll ? scaleSpacing(Space[8]) : scaleSpacing(Space[4]),
            },
          ]}
        >
          <Pressable
            onPress={() => navigation.navigate('Register')}
            accessibilityRole="button"
            accessibilityLabel="Comenzar"
            accessibilityHint="Crea tu cuenta en LIA"
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                minHeight: primaryH,
                paddingVertical: (compact ? 11 : 12) * buttonScale,
                backgroundColor: isHighContrast ? BrandColors.white : BrandColors.navy,
                borderWidth: isHighContrast ? 2 : 0,
                borderColor: BrandColors.white,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text
              maxFontSizeMultiplier={1.3}
              style={[
                styles.primaryLabel,
                {
                  color: isHighContrast ? '#000000' : BrandColors.white,
                  fontSize: scaleFont(16),
                },
              ]}
            >
              Comenzar
            </Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('Login')}
            accessibilityRole="button"
            accessibilityLabel="Ya tengo cuenta"
            accessibilityHint="Inicia sesión en LIA"
            style={({ pressed }) => [
              styles.secondaryBtn,
              {
                minHeight: secondaryH,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Text
              maxFontSizeMultiplier={1.3}
              style={[
                styles.secondaryLabel,
                {
                  color: secondaryColor,
                  fontSize: scaleFont(15),
                  opacity: isHighContrast ? 1 : 0.88,
                },
              ]}
            >
              Ya tengo cuenta
            </Text>
            <Ionicons
              name="arrow-forward"
              size={scaleFont(14)}
              color={secondaryColor}
              style={{ marginLeft: 5, opacity: 0.75 }}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      {needsScroll ? (
        <ScrollView
          style={styles.root}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  column: {
    flex: 1,
    width: '100%',
  },
  bodyPad: {
    flex: 1,
    width: '100%',
    overflow: 'visible',
  },
  logoBlock: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 2,
  },
  copyBlock: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: Space[4],
    zIndex: 1,
  },
  title: {
    fontFamily: SERIF,
    fontWeight: FontWeight.regular,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  body: {
    fontFamily: SANS,
    fontWeight: FontWeight.regular,
    textAlign: 'center',
    maxWidth: 340,
    letterSpacing: 0.1,
  },
  flexSpacer: {
    flexGrow: 0.3,
    flexShrink: 1,
    minHeight: Space[4],
    maxHeight: Space[24],
  },
  flexSpacerTight: {
    flexGrow: 0.1,
    maxHeight: Space[12],
  },
  actions: {
    width: '100%',
    alignItems: 'center',
  },
  primaryBtn: {
    width: '100%',
    maxWidth: 380,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontFamily: SANS_MEDIUM,
    fontWeight: FontWeight.semiBold,
    letterSpacing: 0.15,
  },
  secondaryBtn: {
    width: '100%',
    maxWidth: 380,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  secondaryLabel: {
    fontFamily: SANS_MEDIUM,
    fontWeight: FontWeight.medium,
  },
});
