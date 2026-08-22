import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Keyboard,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { DrugSearchResult, RootStackParamList } from '../types';
import {
  AppText,
  Button,
  EditorialText,
  EmptyState,
  Header,
  Input,
  Screen,
  Toast,
} from '../components';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors } from '../theme/brand';
import { Radius, Space } from '../theme/tokens';
import {
  SEARCH_MIN_CHARS,
  searchDrugs,
  DrugReferenceApiError,
} from '../services/drugReferenceApi';
import { friendlyTtyLabel } from '../utils/drugReferenceLabels';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'DrugSearch'>;
  route: RouteProp<RootStackParamList, 'DrugSearch'>;
};

export default function DrugSearchScreen({ navigation, route }: Props) {
  const { scaleSpacing, scaleFont, minTouch } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const { compact } = useResponsive();

  const [query, setQuery] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<DrugSearchResult[] | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  const busy = searching;

  useFocusEffect(
    useCallback(() => {
      if (route.params?.fresh) {
        setQuery('');
        setResults(null);
        setFieldError(undefined);
        navigation.setParams({ fresh: undefined });
      }
    }, [route.params?.fresh, navigation])
  );

  const runSearch = useCallback(async () => {
    const trimmed = query.trim();
    Keyboard.dismiss();

    if (!trimmed) {
      setFieldError('Escribe el nombre de un medicamento.');
      setResults(null);
      return;
    }
    if (trimmed.length < SEARCH_MIN_CHARS) {
      setFieldError('Escribe al menos 2 caracteres.');
      setResults(null);
      return;
    }

    setFieldError(undefined);
    setSearching(true);
    setResults(null);

    try {
      const data = await searchDrugs(trimmed, 10);
      setResults(data);
    } catch (e) {
      const message =
        e instanceof DrugReferenceApiError
          ? e.message
          : 'No pudimos completar la búsqueda. Inténtalo nuevamente.';
      setToast({ visible: true, message });
      setResults(null);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const onSelect = (item: DrugSearchResult) => {
    if (busy) return;
    navigation.navigate('DrugInfo', {
      rxcui: item.id,
      displayName: item.displayName || item.name,
    });
  };

  const divider = isHighContrast
    ? colors.border
    : isDark
      ? colors.border
      : 'rgba(47,65,86,0.12)';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Header title="Buscar" showBack onBack={() => navigation.goBack()} editorial />

      <Screen
        scroll
        padded
        keyboard
        contentStyle={{ paddingBottom: scaleSpacing(Space[40]) }}
      >
        <EditorialText
          variant="headline"
          accessibilityRole="header"
          style={{
            fontSize: scaleFont(compact ? 28 : 32),
            lineHeight: scaleFont(compact ? 34 : 38),
            marginBottom: scaleSpacing(Space[8]),
          }}
        >
          Busca tu medicamento
        </EditorialText>

        <AppText
          variant="body"
          tone="secondary"
          style={{
            marginBottom: scaleSpacing(Space[20]),
            maxWidth: 420,
            flexShrink: 1,
          }}
        >
          Escribe el nombre y LIA te ayudará a encontrarlo.
        </AppText>

        <Input
          label="Nombre del medicamento"
          placeholder="Ej. Losartán"
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            if (fieldError) setFieldError(undefined);
          }}
          error={fieldError}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => {
            if (!busy) void runSearch();
          }}
          editable={!busy}
          icon={
            <Ionicons
              name="medical-outline"
              size={scaleFont(20)}
              color={colors.textSecondary}
            />
          }
        />

        <Button
          title={searching ? 'Buscando...' : 'Buscar'}
          onPress={() => void runSearch()}
          loading={searching}
          disabled={busy}
          accessibilityLabel="Buscar medicamento"
        />

        {!searching && results && results.length === 0 ? (
          <View style={{ marginTop: scaleSpacing(Space[24]) }}>
            <EmptyState
              icon="search-outline"
              title="No encontramos coincidencias"
              description="Revisa el nombre o intenta escribir una parte diferente."
            />
          </View>
        ) : null}

        {!searching && results && results.length > 0 ? (
          <View style={{ marginTop: scaleSpacing(Space[24]) }}>
            <AppText variant="label" style={{ marginBottom: scaleSpacing(Space[12]) }}>
              Coincidencias
            </AppText>

            <View
              style={[
                styles.list,
                {
                  backgroundColor: isHighContrast
                    ? colors.surface
                    : isDark
                      ? colors.surfaceElevated
                      : BrandColors.white,
                  borderColor: colors.border,
                  borderWidth: isHighContrast ? 2 : 1,
                },
              ]}
            >
              {results.map((item, index) => {
                const ttyLabel = friendlyTtyLabel(item.tty);
                return (
                  <Pressable
                    key={`${item.id}-${index}`}
                    onPress={() => void onSelect(item)}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={item.displayName}
                    accessibilityHint="Abre la ficha informativa de este medicamento"
                    style={({ pressed }) => [
                      styles.resultRow,
                      {
                        minHeight: Math.max(minTouch + 8, 56),
                        borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                        borderTopColor: divider,
                        opacity: pressed ? 0.85 : 1,
                        paddingVertical: scaleSpacing(Space[12]),
                        paddingHorizontal: scaleSpacing(Space[16]),
                      },
                    ]}
                  >
                    <View style={styles.resultText}>
                      <AppText
                        variant="medicationName"
                        style={{ flexShrink: 1, fontSize: scaleFont(17) }}
                      >
                        {item.displayName}
                      </AppText>
                      {ttyLabel ? (
                        <AppText
                          variant="caption"
                          tone="secondary"
                          style={{ marginTop: 4, flexShrink: 1 }}
                        >
                          {ttyLabel}
                        </AppText>
                      ) : null}
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={scaleFont(20)}
                      color={isHighContrast ? colors.textPrimary : isDark ? colors.primary : BrandColors.teal}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </Screen>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type="error"
        onHide={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    width: '100%',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  resultText: {
    flex: 1,
    minWidth: 0,
  },
});
