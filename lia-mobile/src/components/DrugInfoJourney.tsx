import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  PanResponder,
  ScrollView,
  AccessibilityInfo,
  LayoutChangeEvent,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PatientDrugInfo } from '../types';
import { Space } from '../theme/tokens';
import { BrandColors, liaCardBorder } from '../theme/brand';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { useResponsive } from '../hooks/useResponsive';
import { presentDrugName, presentList, presentText } from '../utils/drugReferenceLabels';
import AppText from './AppText';
import Button from './Button';
import SpeakButton from './SpeakButton';
import { buildDrugInfoSpeech } from '../utils/speechPhrases';
import { MedicationInfoImages } from '../utils/medicationInfoAssets';

const CARD_FRONT = '#EDF8FC';
const STACK_FAR = '#82ADC4';
const STACK_MID = '#B8D5E4';
const STACK_NEAR = '#D7EAF4';
const CARD_INK = '#173B59';
const CARD_MUTED = '#527181';
const CARD_EDGE = '#DCE8EE';
const NAVY_BTN = '#173B59';
const ANIM_MS = 240;
const ENTER_MS = 180;
const PEEK_STEP = 11;
const CARD_RADIUS = 30;
const CARD_GUTTER = 28;

type PeekLayer = { color: string; widthPct: number };

function peekLayers(remaining: number): PeekLayer[] {
  const n = Math.min(3, Math.max(0, remaining));
  if (n <= 0) return [];
  if (n === 1) return [{ color: STACK_NEAR, widthPct: 0.96 }];
  if (n === 2) {
    return [
      { color: STACK_MID, widthPct: 0.92 },
      { color: STACK_NEAR, widthPct: 0.96 },
    ];
  }
  return [
    { color: STACK_FAR, widthPct: 0.88 },
    { color: STACK_MID, widthPct: 0.92 },
    { color: STACK_NEAR, widthPct: 0.96 },
  ];
}

function sectionHero(kind: SectionKind): ImageSourcePropType {
  switch (kind) {
    case 'identify':
      return MedicationInfoImages.identifyHero;
    case 'purpose':
      return MedicationInfoImages.purposeHero;
    case 'usage':
      return MedicationInfoImages.usageHero;
    case 'caution':
      return MedicationInfoImages.cautionHero;
    default:
      return MedicationInfoImages.confirmHero;
  }
}

function sectionHeroLabel(kind: SectionKind): string {
  switch (kind) {
    case 'identify':
      return 'Ilustración de medicamentos';
    case 'purpose':
      return 'Ilustración de uso general';
    case 'usage':
      return 'Ilustración de indicaciones';
    case 'caution':
      return 'Ilustración de información importante';
    default:
      return 'Ilustración para agregar el medicamento';
  }
}

function cascadeForward(from: PeekLayer[], restTo: PeekLayer[]): PeekLayer[] {
  const count = Math.max(from.length, restTo.length);
  const out: PeekLayer[] = [];
  for (let i = 0; i < count; i++) {
    const dest = restTo[i];
    const src = from[i];
    if (!src) {
      if (dest) out.push(dest);
      continue;
    }
    out.push({
      color: from[i + 1]?.color ?? CARD_FRONT,
      widthPct: dest?.widthPct ?? 1,
    });
  }
  return out;
}

type SectionKind = 'identify' | 'purpose' | 'usage' | 'caution' | 'next';

type DeckSection = {
  key: string;
  category: string;
  title: string;
  kind: SectionKind;
};

type Props = {
  info: PatientDrugInfo;
  onAdd: () => void;
  onSearchAgain: () => void;
  onBack: () => void;
  displayName: string;
  formLine: string | null;
  sourceLabel?: string | null;
  disclaimer: string;
  canSpeak: boolean;
  adding?: boolean;
};

function buildSections(): DeckSection[] {
  return [
    {
      key: 'identify',
      category: 'Identificación',
      title: '¿Qué medicamento es?',
      kind: 'identify',
    },
    {
      key: 'purpose',
      category: 'Uso general',
      title: '¿Para qué se utiliza?',
      kind: 'purpose',
    },
    {
      key: 'usage',
      category: 'Indicaciones',
      title: '¿Qué debes saber?',
      kind: 'usage',
    },
    {
      key: 'caution',
      category: 'Información importante',
      title: 'Información importante',
      kind: 'caution',
    },
    {
      key: 'next',
      category: 'Confirmación',
      title: '¿Quieres agregar este medicamento?',
      kind: 'next',
    },
  ];
}

function sectionGlyph(kind: SectionKind): React.ComponentProps<typeof Ionicons>['name'] {
  switch (kind) {
    case 'identify':
      return 'medkit-outline';
    case 'purpose':
      return 'heart-outline';
    case 'usage':
      return 'document-text-outline';
    case 'caution':
      return 'alert-circle-outline';
    default:
      return 'checkmark-circle-outline';
  }
}

function WhiteCapsule({
  children,
  bg,
}: {
  children: React.ReactNode;
  bg: string;
}) {
  return (
    <View style={[styles.capsule, { backgroundColor: bg }]}>
      {children}
    </View>
  );
}

function InfoFact({
  image,
  imageLabel,
  label,
  value,
  labelColor,
  valueColor,
  cardBg,
}: {
  image: ImageSourcePropType;
  imageLabel: string;
  label: string;
  value: string;
  labelColor: string;
  valueColor: string;
  cardBg: string;
}) {
  const { scaleFont, scaleSpacing } = useAccessibility();
  return (
    <View
      style={[
        styles.factCard,
        {
          backgroundColor: cardBg,
          paddingVertical: scaleSpacing(14),
          paddingHorizontal: scaleSpacing(16),
        },
      ]}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Image
        source={image}
        style={styles.factIcon}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
        accessible
        accessibilityLabel={imageLabel}
      />
      <View style={styles.factCopy}>
        <AppText variant="caption" style={{ color: labelColor, fontWeight: '500', flexShrink: 1 }}>
          {label}
        </AppText>
        <AppText
          variant="body"
          style={{
            marginTop: 2,
            color: valueColor,
            flexShrink: 1,
            fontSize: scaleFont(17),
            lineHeight: scaleFont(24),
            fontWeight: '600',
          }}
        >
          {value}
        </AppText>
      </View>
    </View>
  );
}

function BodyPanel({
  children,
  bg,
}: {
  children: React.ReactNode;
  bg: string;
}) {
  const { scaleSpacing } = useAccessibility();
  return (
    <View
      style={[
        styles.bodyPanel,
        { backgroundColor: bg, padding: scaleSpacing(16) },
      ]}
    >
      {children}
    </View>
  );
}

function BulletList({ items, color }: { items: string[]; color: string }) {
  const { scaleSpacing, scaleFont } = useAccessibility();
  return (
    <View style={{ gap: scaleSpacing(Space[12]) }}>
      {items.map((item, index) => (
        <View key={`${index}-${item.slice(0, 24)}`} style={styles.bulletRow}>
          <View style={[styles.bulletDot, { backgroundColor: CARD_INK }]} />
          <AppText
            variant="body"
            style={{
              flex: 1,
              flexShrink: 1,
              minWidth: 0,
              color,
              fontSize: scaleFont(16),
              lineHeight: scaleFont(26),
            }}
          >
            {item}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function EmptyBlock({ message, color }: { message: string; color: string }) {
  return (
    <AppText variant="body" style={{ color, flexShrink: 1, lineHeight: 26 }}>
      {message}
    </AppText>
  );
}

export default function DrugInfoJourney({
  info,
  onAdd,
  onSearchAgain,
  onBack,
  displayName,
  formLine,
  sourceLabel,
  disclaimer,
  canSpeak,
  adding = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors, isHighContrast, isDark } = useTheme();
  const { scaleSpacing, scaleFont, minTouch } = useAccessibility();
  const { width: screenWidth, horizontalPadding, isSmallPhone } = useResponsive();
  const lightChrome = !isDark && !isHighContrast;

  const sections = useMemo(() => buildSections(), []);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [deckHeight, setDeckHeight] = useState(420);
  const shift = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(1)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const depth = useRef(new Animated.Value(0)).current;
  const frontTint = useRef(new Animated.Value(1)).current;
  const [tintFromColor, setTintFromColor] = useState(CARD_FRONT);
  const [peekFrame, setPeekFrame] = useState<{ from: PeekLayer[]; to: PeekLayer[] }>({
    from: [],
    to: [],
  });
  const indexRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);

  const name = presentDrugName(info.name);
  const generic = presentDrugName(info.genericName);
  const brands = presentList(info.brandNames).map((item) => presentDrugName(item) ?? item);
  const forms = presentList(info.dosageForms);
  const purpose = presentText(info.purpose);
  const important = presentList(info.importantInformation);
  const precautions = presentList(info.precautions);

  const safeIndex = Math.min(index, Math.max(0, sections.length - 1));
  const current = sections[safeIndex];
  const isFirst = safeIndex === 0;
  const isLast = safeIndex === sections.length - 1;
  const total = sections.length;
  const peekCount = Math.min(3, Math.max(0, total - 1 - safeIndex));
  const peekReserve = peekCount * PEEK_STEP;

  const ink = lightChrome ? CARD_INK : colors.textPrimary;
  const muted = lightChrome ? CARD_MUTED : colors.textSecondary;
  const headerInk = lightChrome ? BrandColors.navy : colors.textPrimary;
  const cardBg = lightChrome ? CARD_FRONT : colors.surface;
  const cardBorder = lightChrome ? CARD_EDGE : liaCardBorder(false, colors.border);
  const badgeBg = lightChrome ? BrandColors.white : colors.surfaceElevated;
  const restPeeks = peekLayers(peekCount);
  const locked = busy || adding;
  const touchSize = Math.max(minTouch, 54);
  const sideGutter = Math.max(horizontalPadding, CARD_GUTTER);
  const stackWidth = Math.max(0, screenWidth - sideGutter * 2);
  const peekInset = (widthPct: number) => (stackWidth * (1 - widthPct)) / 2;

  const identifyFacts: {
    key: string;
    label: string;
    value: string;
    image: ImageSourcePropType;
    imageLabel: string;
  }[] = [
    {
      key: 'name',
      label: 'Nombre',
      value: name || displayName || 'Medicamento',
      image: MedicationInfoImages.name,
      imageLabel: 'Frasco de medicamento',
    },
    {
      key: 'generic',
      label: 'Principio activo',
      value: generic || 'No registrado',
      image: MedicationInfoImages.ingredient,
      imageLabel: 'Principio activo',
    },
    {
      key: 'brands',
      label: brands.length === 1 ? 'Marca' : 'Marcas',
      value: brands.length > 0 ? brands.join(', ') : 'No registradas',
      image: MedicationInfoImages.brands,
      imageLabel: 'Marcas del medicamento',
    },
  ];
  if (formLine || forms.length > 0) {
    identifyFacts.push({
      key: 'forms',
      label: forms.length === 1 ? 'Presentación' : 'Presentaciones',
      value: formLine || forms.join(', '),
      image: MedicationInfoImages.name,
      imageLabel: 'Presentación del medicamento',
    });
  }

  const purposeParagraphs = purpose
    ? purpose
        .split(/\n+/)
        .map((part) => part.trim())
        .filter(Boolean)
    : [];

  useEffect(() => {
    setIndex(0);
    indexRef.current = 0;
    shift.setValue(0);
    dragX.setValue(0);
    enter.setValue(1);
    depth.setValue(0);
    frontTint.setValue(1);
    setTintFromColor(CARD_FRONT);
  }, [info.id, info.name, shift, dragX, enter, depth, frontTint]);

  useEffect(() => {
    if (!current) return;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    AccessibilityInfo.announceForAccessibility(
      `Tarjeta ${safeIndex + 1} de ${total}. ${current.title}`
    );
  }, [safeIndex, total, current]);

  const animateTo = useCallback(
    (next: number) => {
      if (locked) return;
      if (next < 0 || next >= sections.length || next === indexRef.current) return;
      setBusy(true);
      const goingNext = next > indexRef.current;
      const fromLayers = peekLayers(Math.min(3, Math.max(0, sections.length - 1 - indexRef.current)));
      const restTo = peekLayers(Math.min(3, Math.max(0, sections.length - 1 - next)));
      const toLayers = goingNext ? cascadeForward(fromLayers, restTo) : restTo;
      setPeekFrame({ from: fromLayers, to: toLayers });
      setTintFromColor(fromLayers[fromLayers.length - 1]?.color ?? CARD_FRONT);
      depth.setValue(0);
      Animated.parallel([
        Animated.timing(shift, {
          toValue: goingNext ? 1 : -1,
          duration: ANIM_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(depth, {
          toValue: 1,
          duration: ANIM_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start(({ finished }) => {
        if (!finished) {
          setBusy(false);
          return;
        }
        indexRef.current = next;
        setIndex(next);
        shift.setValue(0);
        dragX.setValue(0);
        depth.setValue(0);
        setPeekFrame({ from: restTo, to: restTo });
        enter.setValue(0);
        frontTint.setValue(0);
        Animated.parallel([
          Animated.timing(enter, {
            toValue: 1,
            duration: ENTER_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(frontTint, {
            toValue: 1,
            duration: ENTER_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
        ]).start(() => setBusy(false));
      });
    },
    [locked, sections.length, shift, dragX, enter, depth, frontTint]
  );

  const goNext = useCallback(() => animateTo(indexRef.current + 1), [animateTo]);
  const goPrev = useCallback(() => animateTo(indexRef.current - 1), [animateTo]);
  const goNextRef = useRef(goNext);
  const goPrevRef = useRef(goPrev);
  goNextRef.current = goNext;
  goPrevRef.current = goPrev;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 1.25,
      onPanResponderMove: (_, g) => {
        dragX.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -48) {
          goNextRef.current();
          return;
        }
        if (g.dx > 48) {
          goPrevRef.current();
          return;
        }
        Animated.timing(dragX, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.timing(dragX, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  const onDeckLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    if (height < 8) return;
    if (Math.abs(height - deckHeight) < 1) return;
    setDeckHeight(height);
  };

  const maxCardH = Math.max(240, deckHeight - peekReserve);
  const cardHeight = maxCardH;
  const peekH = cardHeight;

  const renderBody = (section: DeckSection) => {
    const panelBg = lightChrome ? BrandColors.white : colors.surfaceElevated;
    if (section.kind === 'identify') {
      return (
        <View style={{ gap: scaleSpacing(10) }}>
          {identifyFacts.map((fact) => (
            <InfoFact
              key={fact.key}
              image={fact.image}
              imageLabel={fact.imageLabel}
              label={fact.label}
              value={fact.value}
              labelColor={muted}
              valueColor={ink}
              cardBg={panelBg}
            />
          ))}
        </View>
      );
    }
    if (section.kind === 'purpose') {
      if (purposeParagraphs.length === 0) {
        return (
          <BodyPanel bg={panelBg}>
            <EmptyBlock
              message="No hay información de uso general disponible para este medicamento."
              color={muted}
            />
          </BodyPanel>
        );
      }
      return (
        <BodyPanel bg={panelBg}>
          <View style={{ gap: scaleSpacing(Space[12]) }}>
            {purposeParagraphs.map((paragraph, i) => (
              <AppText
                key={`purpose-${i}`}
                variant="body"
                style={{
                  color: ink,
                  flexShrink: 1,
                  fontSize: scaleFont(16),
                  lineHeight: scaleFont(26),
                }}
              >
                {paragraph}
              </AppText>
            ))}
          </View>
        </BodyPanel>
      );
    }
    if (section.kind === 'usage') {
      if (important.length === 0) {
        return (
          <BodyPanel bg={panelBg}>
            <EmptyBlock
              message="No hay indicaciones adicionales disponibles para este medicamento."
              color={muted}
            />
          </BodyPanel>
        );
      }
      return (
        <BodyPanel bg={panelBg}>
          <BulletList items={important} color={ink} />
        </BodyPanel>
      );
    }
    if (section.kind === 'caution') {
      if (precautions.length === 0) {
        return (
          <BodyPanel bg={panelBg}>
            <EmptyBlock
              message="No hay información importante adicional disponible para este medicamento."
              color={muted}
            />
          </BodyPanel>
        );
      }
      return (
        <BodyPanel bg={panelBg}>
          <BulletList items={precautions} color={ink} />
        </BodyPanel>
      );
    }
    return (
      <BodyPanel bg={panelBg}>
        <AppText
          variant="body"
          style={{
            color: muted,
            flexShrink: 1,
            fontSize: scaleFont(16),
            lineHeight: scaleFont(26),
            marginBottom: scaleSpacing(Space[16]),
          }}
        >
          Guárdalo para organizar tus tomas y recordatorios.
        </AppText>
        {sourceLabel ? (
          <AppText variant="caption" style={{ color: muted, flexShrink: 1, marginBottom: 8 }}>
            {sourceLabel}
          </AppText>
        ) : null}
        <AppText variant="caption" style={{ color: muted, flexShrink: 1 }}>
          {disclaimer}
        </AppText>
        {canSpeak ? (
          <SpeakButton
            id={`drug-info-${info.id ?? name ?? 'med'}`}
            label="Escuchar información"
            stopLabel="Detener"
            text={() => buildDrugInfoSpeech(info)}
            style={{ marginTop: scaleSpacing(Space[16]) }}
          />
        ) : null}
      </BodyPanel>
    );
  };

  if (!current) return null;

  return (
    <View style={[styles.wrap, { backgroundColor: lightChrome ? '#FFFFFF' : colors.background }]}>
      <View
        style={{
          paddingTop: insets.top + scaleSpacing(Space[8]),
          paddingHorizontal: sideGutter,
          paddingBottom: scaleSpacing(Space[8]),
        }}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={({ pressed }) => [
              styles.headerSide,
              { minWidth: touchSize, minHeight: touchSize, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Ionicons name="chevron-back" size={24} color={headerInk} />
          </Pressable>

            <AppText
            variant="h2"
            accessibilityRole="header"
            numberOfLines={2}
            style={{
              flex: 1,
              textAlign: 'center',
              color: headerInk,
              fontWeight: '600',
              flexShrink: 1,
              fontSize: scaleFont(isSmallPhone ? 15 : 16),
              lineHeight: scaleFont(isSmallPhone ? 20 : 22),
            }}
          >
            Información del medicamento
          </AppText>

          <View style={[styles.headerSide, { minWidth: touchSize, minHeight: touchSize }]}>
            <AppText
              variant="caption"
              style={{ color: headerInk, fontWeight: '600' }}
              accessibilityLabel={`Tarjeta ${safeIndex + 1} de ${total}`}
            >
              {safeIndex + 1} de {total}
            </AppText>
          </View>
        </View>

        <AppText
          variant="h1"
          numberOfLines={2}
          style={{
            color: ink,
            fontWeight: '700',
            fontSize: scaleFont(isSmallPhone ? 24 : 28),
            lineHeight: scaleFont(isSmallPhone ? 30 : 34),
            marginTop: scaleSpacing(Space[12]),
            textAlign: 'center',
            flexShrink: 1,
          }}
        >
          {displayName}
        </AppText>
      </View>

      <View
        style={[
          styles.deck,
          {
            paddingHorizontal: sideGutter,
            paddingTop: scaleSpacing(Space[16]),
          },
        ]}
        onLayout={onDeckLayout}
        {...pan.panHandlers}
      >
        <View style={[styles.stack, { paddingTop: peekReserve, maxHeight: deckHeight }]}>
          {(busy ? Math.max(peekFrame.from.length, peekFrame.to.length) : restPeeks.length) > 0
            ? Array.from({
                length: busy ? Math.max(peekFrame.from.length, peekFrame.to.length) : restPeeks.length,
              }).map((_, i) => {
                const fromLayer = (busy ? peekFrame.from : restPeeks)[i] ?? null;
                const toLayer = (busy ? peekFrame.to : restPeeks)[i] ?? null;
                const restLayer = restPeeks[i] ?? fromLayer ?? toLayer;
                if (!lightChrome) {
                  if (!restLayer) return null;
                  const inset = peekInset(restLayer.widthPct);
                  return (
                    <View
                      key={`peek-static-${i}`}
                      pointerEvents="none"
                      style={[
                        styles.peekCard,
                        {
                          top: i * PEEK_STEP,
                          height: peekH,
                          left: inset,
                          right: inset,
                          backgroundColor: colors.surfaceElevated,
                        },
                      ]}
                    />
                  );
                }
                const fromColor = fromLayer?.color ?? toLayer?.color ?? STACK_FAR;
                const toColor = toLayer?.color ?? fromLayer?.color ?? STACK_FAR;
                const fromW = fromLayer?.widthPct ?? toLayer?.widthPct ?? 1;
                const toW = toLayer?.widthPct ?? fromLayer?.widthPct ?? 1;
                const fromInset = peekInset(fromW);
                const toInset = peekInset(toW);
                return (
                  <Animated.View
                    key={`peek-${i}`}
                    pointerEvents="none"
                    style={[
                      styles.peekCard,
                      {
                        top: i * PEEK_STEP,
                        height: peekH,
                        zIndex: i + 1,
                        backgroundColor: depth.interpolate({
                          inputRange: [0, 1],
                          outputRange: [fromColor, toColor],
                        }),
                        left: depth.interpolate({
                          inputRange: [0, 1],
                          outputRange: [fromInset, toInset],
                        }),
                        right: depth.interpolate({
                          inputRange: [0, 1],
                          outputRange: [fromInset, toInset],
                        }),
                      },
                    ]}
                  />
                );
              })
            : null}

          <Animated.View
            style={[
              styles.card,
              {
                height: cardHeight,
                zIndex: 8,
                opacity: Animated.multiply(
                  enter,
                  shift.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: [0, 1, 0],
                    extrapolate: 'clamp',
                  })
                ),
                transform: [
                  {
                    translateX: Animated.add(
                      dragX,
                      shift.interpolate({
                        inputRange: [-1, 0, 1],
                        outputRange: [screenWidth, 0, -screenWidth],
                        extrapolate: 'clamp',
                      })
                    ),
                  },
                  {
                    translateY: enter.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.cardFace,
                {
                  backgroundColor: lightChrome
                    ? frontTint.interpolate({
                        inputRange: [0, 1],
                        outputRange: [tintFromColor, CARD_FRONT],
                      })
                    : cardBg,
                  borderColor: isHighContrast ? colors.border : cardBorder,
                  borderWidth: isHighContrast ? 2 : StyleSheet.hairlineWidth,
                  shadowColor: lightChrome ? CARD_INK : '#000000',
                  shadowOpacity: lightChrome ? 0.1 : 0,
                  shadowRadius: lightChrome ? 20 : 0,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: lightChrome ? 4 : 0,
                },
              ]}
            >
            <View style={styles.frontInner}>
            <View
              style={{
                paddingHorizontal: scaleSpacing(Space[20]),
                paddingTop: scaleSpacing(Space[16]),
                paddingBottom: scaleSpacing(Space[8]),
              }}
            >
              <View style={styles.capsuleRow}>
                <View style={{ flexShrink: 1, maxWidth: '72%' }}>
                  <WhiteCapsule bg={badgeBg}>
                    <Ionicons name={sectionGlyph(current.kind)} size={14} color={ink} />
                    <AppText
                      variant="caption"
                      style={{ color: ink, fontWeight: '600', flexShrink: 1 }}
                      numberOfLines={1}
                    >
                      {current.category}
                    </AppText>
                  </WhiteCapsule>
                </View>
                <WhiteCapsule bg={badgeBg}>
                  <AppText
                    variant="caption"
                    style={{ color: ink, fontWeight: '600' }}
                    accessibilityLabel={`Tarjeta ${safeIndex + 1} de ${total}`}
                  >
                    {safeIndex + 1} de {total}
                  </AppText>
                </WhiteCapsule>
              </View>
              <View style={styles.heroRow}>
                <AppText
                  variant="h3"
                  accessibilityRole="header"
                  numberOfLines={3}
                  style={{
                    color: ink,
                    fontWeight: '700',
                    flex: 1,
                    minWidth: 0,
                    flexShrink: 1,
                    fontSize: scaleFont(isSmallPhone ? 20 : 22),
                    lineHeight: scaleFont(isSmallPhone ? 26 : 28),
                    paddingRight: 8,
                  }}
                >
                  {current.title}
                </AppText>
                <Image
                  source={sectionHero(current.kind)}
                  style={{
                    width: isSmallPhone ? 108 : 132,
                    height: isSmallPhone ? 82 : 100,
                  }}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                  accessible
                  accessibilityLabel={sectionHeroLabel(current.kind)}
                />
              </View>
            </View>

            <ScrollView
              ref={scrollRef}
              style={styles.cardScroll}
              contentContainerStyle={{
                paddingHorizontal: scaleSpacing(Space[20]),
                paddingBottom: scaleSpacing(Space[12]),
                flexGrow: 1,
              }}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {renderBody(current)}
            </ScrollView>

            <View
              style={{
                paddingHorizontal: scaleSpacing(Space[20]),
                paddingTop: scaleSpacing(Space[8]),
                paddingBottom: scaleSpacing(Space[16]),
                gap: scaleSpacing(Space[8]),
              }}
            >
              {isLast ? (
                <>
                  <Button
                    title="Agregar a mis medicamentos"
                    onPress={onAdd}
                    disabled={locked}
                    accessibilityLabel="Agregar a mis medicamentos"
                    style={{ minHeight: Math.max(touchSize, 58) }}
                  />
                  <Button
                    title="Buscar otro medicamento"
                    variant="outline"
                    onPress={onSearchAgain}
                    disabled={locked}
                    accessibilityLabel="Buscar otro medicamento"
                    style={{ minHeight: Math.max(touchSize, 58) }}
                  />
                </>
              ) : (
                <Pressable
                  onPress={goNext}
                  disabled={locked}
                  accessibilityRole="button"
                  accessibilityLabel="Siguiente información"
                  accessibilityHint={`Pasa a la tarjeta ${safeIndex + 2} de ${total}`}
                  style={({ pressed }) => [
                    styles.nextBtn,
                    {
                      minHeight: Math.max(touchSize, 58),
                      backgroundColor: isHighContrast ? colors.surface : NAVY_BTN,
                      borderWidth: isHighContrast ? 2 : 0,
                      borderColor: colors.border,
                      opacity: pressed || locked ? 0.85 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.nextCircle,
                      { backgroundColor: isHighContrast ? colors.surfaceElevated : BrandColors.white },
                    ]}
                  >
                    <Ionicons name="arrow-forward" size={18} color={NAVY_BTN} />
                  </View>
                  <AppText
                    variant="button"
                    style={{
                      color: isHighContrast ? colors.textPrimary : BrandColors.white,
                      flex: 1,
                      textAlign: 'center',
                      flexShrink: 1,
                    }}
                    numberOfLines={1}
                  >
                    Siguiente información
                  </AppText>
                  <View style={styles.nextChevrons} accessible={false}>
                    <Ionicons name="chevron-forward" size={14} color={BrandColors.white} />
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={BrandColors.white}
                      style={{ marginLeft: -8, opacity: 0.7 }}
                    />
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={BrandColors.white}
                      style={{ marginLeft: -8, opacity: 0.4 }}
                    />
                  </View>
                </Pressable>
              )}

              {!isFirst ? (
                <Pressable
                  onPress={goPrev}
                  disabled={locked}
                  accessibilityRole="button"
                  accessibilityLabel="Anterior"
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.prevLink,
                    { minHeight: touchSize, opacity: pressed || locked ? 0.7 : 1 },
                  ]}
                >
                  <AppText variant="label" style={{ color: headerInk, fontWeight: '600' }}>
                    Anterior
                  </AppText>
                </Pressable>
              ) : null}
            </View>
            </View>
            </Animated.View>
          </Animated.View>
        </View>
      </View>

      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={`Tarjeta ${safeIndex + 1} de ${total}`}
        style={[
          styles.dotsRow,
          {
            marginTop: scaleSpacing(Space[16]),
            marginBottom: scaleSpacing(Space[16]) + insets.bottom,
          },
        ]}
      >
        {sections.map((section, i) => (
          <View
            key={section.key}
            style={[
              styles.dot,
              {
                backgroundColor:
                  i === safeIndex
                    ? headerInk
                    : lightChrome
                      ? STACK_NEAR
                      : colors.border,
                width: i === safeIndex ? 22 : 8,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSide: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  deck: {
    flex: 1,
    minHeight: 0,
    overflow: 'visible',
  },
  stack: {
    width: '100%',
    position: 'relative',
    overflow: 'visible',
  },
  peekCard: {
    position: 'absolute',
    borderRadius: CARD_RADIUS,
    borderWidth: 0,
    overflow: 'hidden',
  },
  card: {
    width: '100%',
    borderRadius: CARD_RADIUS,
  },
  cardFace: {
    flex: 1,
    borderRadius: CARD_RADIUS,
  },
  frontInner: {
    flex: 1,
    minHeight: 0,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
  },
  capsuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  capsule: {
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: CARD_INK,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardScroll: {
    flex: 1,
    minHeight: 0,
  },
  nextBtn: {
    width: '100%',
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  nextCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  nextChevrons: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 42,
    justifyContent: 'flex-end',
    flexShrink: 0,
    paddingRight: 6,
  },
  prevLink: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  factCard: {
    width: '100%',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: CARD_INK,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  factIcon: {
    width: 40,
    height: 40,
    flexShrink: 0,
  },
  factCopy: {
    flex: 1,
    minWidth: 0,
  },
  bodyPanel: {
    width: '100%',
    borderRadius: 20,
    shadowColor: CARD_INK,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    width: '100%',
  },
  bulletDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 8,
    flexShrink: 0,
  },
});
