import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Keyboard,
  Image,
  Pressable,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types';
import {
  AppText,
  DrugSearchBar,
  Screen,
} from '../components';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors } from '../theme/brand';
import { Space } from '../theme/tokens';
import {
  SEARCH_MIN_CHARS,
  searchDrugs,
  DrugReferenceApiError,
} from '../services/drugReferenceApi';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'DrugSearch'>;
  route: RouteProp<RootStackParamList, 'DrugSearch'>;
};

const HERO_BG = '#EAF3F7';
const ORGANIC = '#DCE8EE';
const SHEET_BG = '#FFFFFF';
const SENIORS_IMAGE = require('../assets/images/adultosmayorbuscando.png');

function searchFailureMessage(error: unknown): string {
  if (error instanceof DrugReferenceApiError && error.status !== undefined) {
    return error.message;
  }
  return 'No pudimos realizar la búsqueda. Verifica tu conexión y vuelve a intentarlo.';
}

export default function DrugSearchScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { scaleSpacing, scaleFont, minTouch } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const { compact, width, horizontalPadding, isShortScreen } = useResponsive();
  const lightChrome = !isDark && !isHighContrast;

  const [query, setQuery] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [searching, setSearching] = useState(false);
  const inFlight = useRef(false);

  const busy = searching;
  const heroBg = isHighContrast ? colors.background : isDark ? colors.surface : HERO_BG;
  const sheetBg = lightChrome ? SHEET_BG : colors.background;
  const artWidth = Math.round(width * (isShortScreen ? 0.78 : compact ? 0.88 : 0.94));
  const artHeight = Math.round(artWidth * (1249 / 1406));
  const overlap = Math.round(Math.min(35, Math.max(24, artHeight * 0.09)));
  const circleSize = Math.round(width * 2.05);
  const radius = circleSize / 2;
  const capHeight = Math.max(
    overlap + 12,
    Math.round(radius - Math.sqrt(Math.max(0, radius * radius - (width / 2) * (width / 2))))
  );
  const barWidth = Math.min(Math.round(width * 0.86), 360);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.fresh) {
        setQuery('');
        setFieldError(undefined);
        navigation.setParams({ fresh: undefined });
      }
    }, [route.params?.fresh, navigation])
  );

  const runSearch = useCallback(async () => {
    if (inFlight.current || searching) return;

    const trimmed = query.trim();
    Keyboard.dismiss();

    if (!trimmed) {
      setFieldError('Escribe el nombre del medicamento para comenzar.');
      return;
    }
    if (trimmed.length < SEARCH_MIN_CHARS) {
      setFieldError('Escribe al menos 2 caracteres.');
      return;
    }

    inFlight.current = true;
    setFieldError(undefined);
    setSearching(true);

    try {
      const data = await searchDrugs(trimmed, 10);
      navigation.navigate('DrugMatches', {
        query: trimmed,
        results: data,
      });
    } catch (e) {
      navigation.navigate('DrugMatches', {
        query: trimmed,
        results: [],
        error: searchFailureMessage(e),
      });
    } finally {
      inFlight.current = false;
      setSearching(false);
    }
  }, [query, searching, navigation]);

  return (
    <View style={[styles.root, { backgroundColor: sheetBg }]}>
      <Screen
        scroll
        keyboard
        transparent
        padded={false}
        maxWidth={width}
        contentStyle={{
          flexGrow: 1,
          paddingBottom: 0,
        }}
      >
        <View
          style={[
            styles.hero,
            {
              backgroundColor: heroBg,
              paddingTop: insets.top + scaleSpacing(Space[4]),
              paddingHorizontal: horizontalPadding,
            },
          ]}
        >
          {lightChrome ? (
            <View pointerEvents="none" style={[styles.softShape, { backgroundColor: ORGANIC }]} />
          ) : null}

          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={({ pressed }) => [
              styles.backBtn,
              {
                minWidth: minTouch,
                minHeight: minTouch,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={26}
              color={lightChrome ? BrandColors.navy : colors.textPrimary}
            />
          </Pressable>

          <AppText
            variant="label"
            tone="secondary"
            style={{ marginTop: scaleSpacing(Space[4]) }}
          >
            Identificación manual
          </AppText>

          <AppText
            variant="h1"
            accessibilityRole="header"
            style={{
              color: lightChrome ? BrandColors.navy : colors.textPrimary,
              fontSize: scaleFont(26),
              lineHeight: scaleFont(32),
              letterSpacing: -0.2,
              fontWeight: '600',
              marginTop: scaleSpacing(Space[8]),
              marginBottom: scaleSpacing(Space[8]),
            }}
          >
            Encuentra tu medicamento
          </AppText>
        </View>

        <View style={[styles.artBlock, { backgroundColor: heroBg }]}>
          <View
            style={[
              styles.artStage,
              {
                height: artHeight,
              },
            ]}
          >
            <Image
              source={SENIORS_IMAGE}
              style={{
                width: artWidth,
                height: artHeight,
              }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
              accessibilityLabel="Adultos mayores buscando un medicamento"
            />
          </View>

          <View
            style={[
              styles.sheetWrap,
              {
                marginTop: -overlap,
              },
            ]}
          >
            <View style={[styles.waveClip, { height: capHeight, backgroundColor: heroBg }]}>
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: Math.round((width - circleSize) / 2),
                  width: circleSize,
                  height: circleSize,
                  borderRadius: circleSize / 2,
                  backgroundColor: sheetBg,
                }}
              />
            </View>

            <View
              style={[
                styles.sheet,
                {
                  backgroundColor: sheetBg,
                  paddingHorizontal: horizontalPadding,
                  paddingTop: scaleSpacing(Space[24]),
                  paddingBottom: scaleSpacing(Space[32]) + insets.bottom,
                  alignItems: 'center',
                },
              ]}
            >
            <AppText
              variant="h3"
              style={{
                color: lightChrome ? BrandColors.navy : colors.textPrimary,
                textAlign: 'center',
                marginBottom: scaleSpacing(Space[8]),
                flexShrink: 1,
              }}
            >
              Coloca el nombre del medicamento
            </AppText>
            <AppText
              variant="body"
              tone="secondary"
              style={{
                textAlign: 'center',
                marginBottom: scaleSpacing(Space[20]),
                flexShrink: 1,
                maxWidth: barWidth,
              }}
            >
              Escríbelo y pulsa la lupa para buscarlo.
            </AppText>

            <View style={{ width: barWidth }}>
              <DrugSearchBar
                value={query}
                onChangeText={(text) => {
                  setQuery(text);
                  if (fieldError) setFieldError(undefined);
                }}
                onSubmit={() => {
                  if (!busy) void runSearch();
                }}
                searching={searching}
                disabled={busy}
                error={fieldError}
              />
            </View>
          </View>
        </View>
        </View>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    width: '100%',
    zIndex: 3,
  },
  softShape: {
    position: 'absolute',
    width: 240,
    height: 160,
    borderRadius: 120,
    top: -80,
    right: -70,
    opacity: 0.5,
  },
  backBtn: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  artBlock: {
    width: '100%',
    flexGrow: 1,
    overflow: 'visible',
  },
  artStage: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
    zIndex: 1,
  },
  sheetWrap: {
    width: '100%',
    zIndex: 2,
    flexGrow: 1,
  },
  waveClip: {
    width: '100%',
    overflow: 'hidden',
  },
  sheet: {
    width: '100%',
    flexGrow: 1,
  },
});
