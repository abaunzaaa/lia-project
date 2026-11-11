import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Image,
  ImageSourcePropType,
  ScrollView,
  PixelRatio,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '../components/icons/Ionicons';
import { RootStackParamList } from '../types';
import { AppText, EditorialText, Header, SurfaceCard } from '../components';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors } from '../theme/brand';
import { Space } from '../theme/tokens';

const LIA_CAMERA_ART = require('../assets/images/foto-camara.png') as ImageSourcePropType;
const PHONE_CAMERA_ART = require('../assets/images/foto-celular.png') as ImageSourcePropType;

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CameraSource'>;
};

type CameraChoice = {
  key: 'lia' | 'phone';
  image: ImageSourcePropType;
  title: string;
  description: string;
  accessibilityLabel: string;
  accessibilityHint: string;
  onPress: () => void;
};

export default function CameraSourceScreen({ navigation }: Props) {
  const { scaleSpacing, scaleFont, fontScale } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const lightChrome = !isDark && !isHighContrast;
  const { compact, width, horizontalPadding } = useResponsive();
  const insets = useSafeAreaInsets();
  const navigating = useRef(false);
  const [stackHeight, setStackHeight] = useState(0);
  const [introHeight, setIntroHeight] = useState(0);

  useFocusEffect(
    useCallback(() => {
      navigating.current = false;
    }, [])
  );

  const choices: CameraChoice[] = [
    {
      key: 'lia',
      image: LIA_CAMERA_ART,
      title: 'Cámara de LÍA',
      description: 'Reconoce tu medicamento con la cámara de LÍA',
      accessibilityLabel: 'Cámara de LÍA',
      accessibilityHint: 'Abre la guía de la cámara física, como hasta ahora',
      onPress: () => navigation.navigate('CameraGuide'),
    },
    {
      key: 'phone',
      image: PHONE_CAMERA_ART,
      title: 'Cámara de mi celular',
      description: 'Toma una foto de tu medicamento con tu celular',
      accessibilityLabel: 'Cámara de mi celular',
      accessibilityHint: 'Abre la cámara de este celular para fotografiar el medicamento',
      onPress: () => navigation.navigate('PhoneCamera'),
    },
  ];

  const osScale = Math.min(PixelRatio.getFontScale(), 1.35);
  const gap = scaleSpacing(Space[12]);
  const cardPad = scaleSpacing(Space[12]);
  const textBlock =
    scaleFont(18) * osScale * 1.25 + scaleFont(15) * osScale * 1.3 * 2 + scaleSpacing(Space[8]);
  const cardChrome = cardPad * 2 + textBlock;
  const measuredStack = stackHeight > 0 ? stackHeight : 0;
  const leftover = Math.max(0, measuredStack - introHeight - gap);
  const rawArt = measuredStack > 0 ? (leftover - gap - cardChrome * 2) / 2 : width * 0.28;
  const artCap = Math.round(Math.min(width, 520) * (compact ? 0.28 : 0.32));
  const needsScroll = fontScale >= 1.35 || (measuredStack > 0 && rawArt < 64);
  const artHeight = needsScroll
    ? Math.round(Math.min(width, 480) * 0.26)
    : Math.max(64, Math.min(rawArt, artCap));

  const openChoice = (go: () => void) => {
    if (navigating.current) return;
    navigating.current = true;
    go();
  };

  const restingBackground = isHighContrast
    ? colors.surface
    : isDark
      ? colors.surface
      : BrandColors.white;
  const pressedBackground = isHighContrast
    ? colors.surfaceElevated
    : isDark
      ? colors.surfaceElevated
      : colors.accentSoft;
  const restingBorder = isHighContrast
    ? colors.border
    : lightChrome
      ? BrandColors.skyBlue
      : colors.border;

  const cards = choices.map((choice, index) => (
    <Pressable
      key={choice.key}
      onPress={() => openChoice(choice.onPress)}
      accessibilityRole="button"
      accessibilityLabel={choice.accessibilityLabel}
      accessibilityHint={choice.accessibilityHint}
      style={{ marginBottom: index === choices.length - 1 ? 0 : gap }}
    >
      {({ pressed }) => (
        <SurfaceCard
          variant="default"
          style={{
            backgroundColor: pressed ? pressedBackground : restingBackground,
            borderWidth: isHighContrast ? 2 : 1,
            borderColor: pressed && isHighContrast ? colors.textPrimary : restingBorder,
            padding: cardPad,
            justifyContent: 'center',
          }}
        >
          <View style={[styles.artFrame, { height: artHeight }]}>
            <Image
              source={choice.image}
              resizeMode="contain"
              accessible={false}
              accessibilityIgnoresInvertColors
              importantForAccessibility="no"
              style={styles.art}
            />
          </View>

          <View style={[styles.row, { marginTop: scaleSpacing(Space[8]), gap: scaleSpacing(Space[12]) }]}>
            <View style={styles.copy}>
              <AppText variant="medicationName" numberOfLines={2} style={{ flexShrink: 1 }}>
                {choice.title}
              </AppText>
              <AppText
                variant="body"
                tone="secondary"
                numberOfLines={needsScroll ? 3 : 2}
                style={{ marginTop: scaleSpacing(4), flexShrink: 1 }}
              >
                {choice.description}
              </AppText>
            </View>

            <Ionicons
              name="chevron-forward"
              size={scaleFont(22)}
              color={isHighContrast ? colors.textPrimary : BrandColors.teal}
            />
          </View>
        </SurfaceCard>
      )}
    </Pressable>
  ));

  const intro = (
    <View onLayout={(event) => setIntroHeight(event.nativeEvent.layout.height)}>
      <EditorialText
        variant="headline"
        accessibilityRole="header"
        style={{
          fontSize: scaleFont(compact ? 26 : 30),
          lineHeight: scaleFont(compact ? 32 : 36),
          marginBottom: scaleSpacing(Space[8]),
        }}
      >
        ¿Qué cámara quieres usar?
      </EditorialText>
      <AppText
        variant="body"
        tone="secondary"
        numberOfLines={needsScroll ? 4 : 2}
        style={{ marginBottom: gap, maxWidth: 460, flexShrink: 1 }}
      >
        Elige una opción para reconocer tu medicamento. Puedes volver sin iniciar el reconocimiento.
      </AppText>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Header
        title="Elegir cámara"
        showBack
        onBack={() => navigation.goBack()}
        editorial
      />

      <View
        style={{
          flex: 1,
          paddingHorizontal: horizontalPadding,
          paddingBottom: Math.max(insets.bottom, scaleSpacing(Space[8])),
        }}
        onLayout={(event) => setStackHeight(event.nativeEvent.layout.height)}
      >
        {needsScroll ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: scaleSpacing(Space[12]) }}
          >
            {intro}
            {cards}
          </ScrollView>
        ) : (
          <View style={styles.fit}>
            {intro}
            {cards}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fit: { flex: 1 },
  artFrame: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  art: {
    width: '100%',
    height: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
});
