import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { PatientDrugInfo, RootStackParamList } from '../types';
import {
  AppText,
  Button,
  DrugInfoJourney,
  EmptyState,
  Header,
  Screen,
  Toast,
} from '../components';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useMedications } from '../context/MedicationContext';
import { Space } from '../theme/tokens';
import {
  friendlySourceLabel,
  presentDrugName,
  presentList,
  presentText,
} from '../utils/drugReferenceLabels';
import { normalizeMedicationName } from '../utils/helpers';
import {
  getDrugInfoByRxcui,
  DrugReferenceApiError,
} from '../services/drugReferenceApi';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'DrugInfo'>;
  route: RouteProp<RootStackParamList, 'DrugInfo'>;
};

const DEFAULT_DISCLAIMER =
  'Esta información es orientativa y no reemplaza las indicaciones de tu profesional de salud.';

export default function DrugInfoScreen({ navigation, route }: Props) {
  const { rxcui, displayName } = route.params;
  const { scaleSpacing } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const { medications } = useMedications();
  const lightChrome = !isDark && !isHighContrast;
  const pageBg = lightChrome ? '#FFFFFF' : colors.background;

  const [info, setInfo] = useState<PatientDrugInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState({ visible: false, message: '' });
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const data = await getDrugInfoByRxcui(rxcui);
      setInfo(data);
    } catch (e) {
      const message =
        e instanceof DrugReferenceApiError
          ? e.message
          : 'No pudimos consultar la información en este momento. Inténtalo nuevamente.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [rxcui]);

  useEffect(() => {
    void load();
  }, [load]);

  const goSearchAgain = () => {
    navigation.navigate('DrugSearch', { fresh: true });
  };

  const titleName =
    presentDrugName(info?.name) || presentDrugName(displayName) || 'Medicamento';
  const forms = presentList(info?.dosageForms);
  const formLine = forms.length > 0 ? forms.join(' · ') : null;

  const canSpeak =
    !!info &&
    info.informationAvailable &&
    info.simplified &&
    (!!presentText(info.purpose) ||
      presentList(info.importantInformation).length > 0 ||
      presentList(info.precautions).length > 0);

  const sourceLabel = friendlySourceLabel(info?.source?.name);
  const disclaimer = presentText(info?.disclaimer) || DEFAULT_DISCLAIMER;

  const addMedication = () => {
    if (adding || !info) return;
    const medName = (presentDrugName(info.name) || presentDrugName(displayName) || '').trim();
    if (!medName) return;
    const nameNorm = normalizeMedicationName(medName);
    const exists = medications.some(
      (m) => normalizeMedicationName(m.name) === nameNorm
    );
    if (exists) {
      setToast({
        visible: true,
        message: 'Este medicamento ya está registrado.',
      });
      return;
    }
    setAdding(true);
    navigation.navigate('AddMedication', { prefilled: { name: medName } });
    setAdding(false);
  };

  const showJourney =
    !loading && !error && !!info && info.informationAvailable && info.simplified;

  return (
    <View style={[styles.root, { backgroundColor: pageBg }]}>
      {!showJourney ? (
        <Header
          title="Información del medicamento"
          showBack
          onBack={() => navigation.goBack()}
          editorial={false}
          align="center"
          style={{ backgroundColor: pageBg }}
        />
      ) : null}

      {loading ? (
        <View
          style={styles.loadingWrap}
          accessibilityLabel="Estamos preparando la información"
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText
            variant="body"
            tone="secondary"
            style={{
              marginTop: scaleSpacing(Space[16]),
              textAlign: 'center',
            }}
          >
            Estamos preparando la información…
          </AppText>
        </View>
      ) : null}

      {!loading && error ? (
        <Screen scroll transparent padded>
          <EmptyState
            icon="cloud-offline-outline"
            title="No pudimos cargar la información"
            description={error}
          />
          <Button
            title="Intentar nuevamente"
            onPress={() => void load()}
            style={{ marginTop: scaleSpacing(Space[16]) }}
          />
          <Button
            title="Buscar otro medicamento"
            variant="outline"
            onPress={goSearchAgain}
            style={{ marginTop: scaleSpacing(Space[12]) }}
          />
        </Screen>
      ) : null}

      {!loading && !error && info && !info.informationAvailable ? (
        <Screen scroll transparent padded>
          <EmptyState
            icon="document-text-outline"
            title="Información no disponible"
            description="Encontramos el medicamento, pero no tenemos información detallada disponible en este momento."
          />
          <Button
            title="Buscar otro medicamento"
            onPress={goSearchAgain}
            style={{ marginTop: scaleSpacing(Space[16]) }}
          />
        </Screen>
      ) : null}

      {!loading && !error && info && info.informationAvailable && !info.simplified ? (
        <Screen scroll transparent padded>
          <EmptyState
            icon="language-outline"
            title="Información en preparación"
            description="Encontramos información sobre este medicamento, pero no pudimos prepararla en español en este momento."
          />
          <Button
            title="Intentar nuevamente"
            onPress={() => void load()}
            style={{ marginTop: scaleSpacing(Space[16]) }}
          />
          <Button
            title="Buscar otro medicamento"
            variant="outline"
            onPress={goSearchAgain}
            style={{ marginTop: scaleSpacing(Space[12]) }}
          />
        </Screen>
      ) : null}

      {showJourney && info ? (
        <View style={styles.journey}>
          <DrugInfoJourney
            info={info}
            onAdd={addMedication}
            onSearchAgain={goSearchAgain}
            onBack={() => navigation.goBack()}
            displayName={titleName}
            formLine={formLine}
            sourceLabel={sourceLabel}
            disclaimer={disclaimer}
            canSpeak={canSpeak}
            adding={adding}
          />
        </View>
      ) : null}

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
  journey: { flex: 1 },
  loadingWrap: {
    flex: 1,
    paddingVertical: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
