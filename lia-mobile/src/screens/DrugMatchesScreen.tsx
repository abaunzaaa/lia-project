import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DrugSearchResult, RootStackParamList } from '../types';
import {
  AppText,
  DrugMatchCard,
  EmptyState,
  Screen,
} from '../components';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors } from '../theme/brand';
import { Space } from '../theme/tokens';
import { searchDrugs, DrugReferenceApiError } from '../services/drugReferenceApi';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'DrugMatches'>;
  route: RouteProp<RootStackParamList, 'DrugMatches'>;
};

const HERO_BG = '#EAF3F7';
const SHEET_BG = '#FFFFFF';

function searchFailureMessage(error: unknown): string {
  if (error instanceof DrugReferenceApiError && error.status !== undefined) {
    return error.message;
  }
  return 'No pudimos realizar la búsqueda. Verifica tu conexión y vuelve a intentarlo.';
}

export default function DrugMatchesScreen({ navigation, route }: Props) {
  const { query } = route.params;
  const insets = useSafeAreaInsets();
  const { scaleSpacing, scaleFont, minTouch } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const { width, horizontalPadding } = useResponsive();
  const lightChrome = !isDark && !isHighContrast;
  const heroBg = isHighContrast ? colors.background : isDark ? colors.surface : HERO_BG;
  const sheetBg = lightChrome ? SHEET_BG : colors.background;

  const [results, setResults] = useState<DrugSearchResult[]>(route.params.results);
  const [error, setError] = useState<string | undefined>(route.params.error);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setResults(route.params.results);
    setError(route.params.error);
    setSearching(false);
  }, [route.params.query, route.params.results, route.params.error]);

  const retry = useCallback(async () => {
    if (searching) return;
    setSearching(true);
    setError(undefined);
    try {
      const data = await searchDrugs(query, 10);
      setResults(data);
    } catch (e) {
      setResults([]);
      setError(searchFailureMessage(e));
    } finally {
      setSearching(false);
    }
  }, [query, searching]);

  const onSelect = (item: DrugSearchResult) => {
    if (searching) return;
    navigation.navigate('DrugInfo', {
      rxcui: item.id,
      displayName: item.displayName || item.name,
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: sheetBg }]}>
      <View
        style={[
          styles.hero,
          {
            backgroundColor: heroBg,
            paddingTop: insets.top + scaleSpacing(Space[4]),
            paddingHorizontal: horizontalPadding,
            paddingBottom: scaleSpacing(Space[20]),
          },
        ]}
      >
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

        <AppText variant="label" tone="secondary">
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
          }}
        >
          Elige tu medicamento
        </AppText>

        {query ? (
          <AppText
            variant="body"
            tone="secondary"
            style={{
              marginTop: scaleSpacing(Space[8]),
              flexShrink: 1,
            }}
          >
            Encontramos coincidencias para “{query}”
          </AppText>
        ) : null}
      </View>

      <Screen
        scroll
        transparent
        padded={false}
        maxWidth={width}
        contentStyle={{
          flexGrow: 1,
          paddingHorizontal: horizontalPadding,
          paddingTop: scaleSpacing(Space[20]),
          paddingBottom: scaleSpacing(Space[40]) + insets.bottom,
        }}
      >
        {error ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="No pudimos buscar"
            description={error}
            actionLabel="Intentar nuevamente"
            onAction={() => void retry()}
          />
        ) : null}

        {!error && results.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title="Sin coincidencias"
            description="No encontramos ese medicamento. Revisa el nombre e inténtalo nuevamente."
            actionLabel="Buscar de nuevo"
            onAction={() => navigation.goBack()}
          />
        ) : null}

        {!error && results.length > 0 ? (
          <View>
            <AppText
              variant="body"
              tone="secondary"
              style={{
                marginBottom: scaleSpacing(Space[16]),
                flexShrink: 1,
              }}
            >
              Elige el que coincida con tu medicamento.
            </AppText>

            {results.map((item, index) => (
              <DrugMatchCard
                key={`${item.id}-${index}`}
                item={item}
                onPress={() => onSelect(item)}
                disabled={searching}
                directMatch={index === 0}
              />
            ))}
          </View>
        ) : null}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    width: '100%',
  },
  backBtn: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
});
