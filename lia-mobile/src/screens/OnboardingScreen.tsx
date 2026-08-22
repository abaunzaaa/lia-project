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
      ? BrandColors.beige
      : BrandColors.navy;

  const heroHeight = useMemo(() => {
    const ratio = isShortScreen || compact ? 0.42 : isTablet ? 0.46 : 0.48;
    const raw = Math.round(height * ratio);
    const floor = isShortScreen ? 210 : compact ? 230 : 250;
    const cap = isTablet ? 420 : isShortScreen ? 280 : 360;
    return Math.round(Math.min(Math.max(raw, floor), cap));
  }, [height, compact, isTablet, isShortScreen]);

  const logoWidth = isTablet ? 280 : isSeniorMode ? (compact ? 228 : 252) : compact ? 236 : 268;

  const titleSize = scaleFont(compact || isShortScreen ? 24 : isTablet ? 30 : 28);
  const titleLine = scaleFont(compact || isShortScreen ? 30 : isTablet ? 38 : 36);
  const bodySize = scaleFont(compact ? 15 : 16);
  const bodyLine = scaleFont(compact ? 22 : 24);

  const primaryH = Math.max(minTouch, Math.round((compact ? 50 : 54) * buttonScale));
  const secondaryH = Math.max(minTouch, Math.round((compact ? 44 : 48) * buttonScale));

  const needsScroll = isSeniorMode || isShortScreen || height < 680;

  const content = (
    <View
      style={[
        styles.column,
        {
          paddingBottom: Math.max(insets.bottom, scaleSpacing(compact ? Space[16] : Space[20])),
          minHeight: needsScroll ? undefined : height,
        },
      ]}
    >
      <WelcomeHero height={heroHeight} />

      <View
        style={[
          styles.bodyPad,
          {
            paddingHorizontal: horizontalPadding,
            marginTop: scaleSpacing(compact ? Space[4] : Space[8]),
          },
        ]}
      >
        <View style={[styles.logoBlock, { marginBottom: scaleSpacing(compact ? Space[12] : Space[16]) }]}>
          <WelcomeBrandLogo pageBackground={bg} size={logoWidth} />
        </View>

        <View style={[styles.copyBlock, { marginBottom: scaleSpacing(compact ? Space[20] : Space[24]) }]}>
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={1.35}
            style={[
              styles.title,
              {
                color: titleColor,
                fontSize: titleSize,
                lineHeight: titleLine,
                marginBottom: scaleSpacing(Space[12]),
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
              },
            ]}
          >
            Recordatorios, identificación y seguimiento sencillo para ti y tu familia.
          </Text>
        </View>

        {!needsScroll ? <View style={styles.flexSpacer} /> : null}

        <View style={[styles.actions, { gap: scaleSpacing(Space[8]) }]}>
          <Pressable
            onPress={() => navigation.navigate('Register')}
            accessibilityRole="button"
            accessibilityLabel="Comenzar"
            accessibilityHint="Crea tu cuenta en LIA"
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                minHeight: primaryH,
                paddingVertical: (compact ? 14 : 16) * buttonScale,
                backgroundColor: isHighContrast ? BrandColors.white : BrandColors.navy,
                borderWidth: isHighContrast ? 2 : 0,
                borderColor: BrandColors.white,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text
              maxFontSizeMultiplier={1.3}
              numberOfLines={2}
              style={[
                styles.primaryLabel,
                {
                  color: isHighContrast ? '#000000' : BrandColors.white,
                  fontSize: scaleFont(17),
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
                opacity: pressed ? 0.65 : 1,
              },
            ]}
          >
            <Text
              maxFontSizeMultiplier={1.3}
              numberOfLines={1}
              style={[
                styles.secondaryLabel,
                {
                  color: secondaryColor,
                  fontSize: scaleFont(16),
                },
              ]}
            >
              Ya tengo cuenta
            </Text>
            <Ionicons
              name="arrow-forward"
              size={scaleFont(15)}
              color={secondaryColor}
              style={{ marginLeft: 6 }}
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
  },
  logoBlock: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyBlock: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontFamily: SERIF,
    fontWeight: FontWeight.regular,
    letterSpacing: -0.45,
    textAlign: 'center',
    maxWidth: 360,
  },
  body: {
    fontFamily: SANS,
    fontWeight: FontWeight.regular,
    textAlign: 'center',
    maxWidth: 340,
    letterSpacing: 0.15,
  },
  flexSpacer: {
    flexGrow: 1,
    minHeight: Space[8],
  },
  actions: {
    width: '100%',
    alignItems: 'center',
  },
  primaryBtn: {
    width: '100%',
    maxWidth: 380,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontFamily: SANS_MEDIUM,
    fontWeight: FontWeight.semiBold,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  secondaryBtn: {
    width: '100%',
    maxWidth: 380,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  secondaryLabel: {
    fontFamily: SANS_MEDIUM,
    fontWeight: FontWeight.medium,
  },
});
