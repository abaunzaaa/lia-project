import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { PatientDrugInfo, RootStackParamList } from '../types';
import {
  AppText,
  Button,
  EditorialText,
  EmptyState,
  Header,
  Screen,
  SpeakButton,
  Toast,
} from '../components';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useMedications } from '../context/MedicationContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors } from '../theme/brand';
import { Radius, Space } from '../theme/tokens';
import { friendlySourceLabel } from '../utils/drugReferenceLabels';
import { buildDrugInfoSpeech } from '../utils/speechPhrases';
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

function SectionDivider({ color }: { color: string }) {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

function BulletList({ items }: { items: string[] }) {
  const { scaleSpacing, scaleFont } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const bulletColor = isHighContrast ? colors.textPrimary : isDark ? colors.primary : BrandColors.teal;

  return (
    <View style={{ gap: scaleSpacing(Space[12]), marginTop: scaleSpacing(Space[12]) }}>
      {items.map((item, index) => (
        <View key={`${index}-${item.slice(0, 24)}`} style={styles.bulletRow}>
          <View style={[styles.bulletDot, { backgroundColor: bulletColor }]} />
          <AppText
            variant="body"
            style={{
              flex: 1,
              flexShrink: 1,
              minWidth: 0,
              fontSize: scaleFont(16),
              lineHeight: scaleFont(24),
            }}
          >
            {item.trim()}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export default function DrugInfoScreen({ navigation, route }: Props) {
  const { rxcui, displayName } = route.params;
  const { scaleSpacing, scaleFont, minTouch } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const { compact, contentMaxWidth } = useResponsive();
  const { medications } = useMedications();

  const [info, setInfo] = useState<PatientDrugInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState({ visible: false, message: '' });
  const [brandsExpanded, setBrandsExpanded] = useState(false);

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

  const titleName = (info?.name || displayName || 'Medicamento').trim();
  const dividerColor = isHighContrast
    ? colors.border
    : isDark
      ? colors.border
      : 'rgba(47,65,86,0.14)';

  const showGeneric =
    !!info?.genericName?.trim() &&
    info.genericName.trim().toLowerCase() !== info.name.trim().toLowerCase();

  const brandPreview = brandsExpanded
    ? info?.brandNames ?? []
    : (info?.brandNames ?? []).slice(0, 4);
  const brandExtra = Math.max(0, (info?.brandNames.length ?? 0) - 4);

  const canSpeak =
    !!info &&
    info.informationAvailable &&
    info.simplified &&
    (!!info.purpose ||
      info.importantInformation.length > 0 ||
      info.precautions.length > 0);

  const readingWidth = Math.min(contentMaxWidth, 560);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {!isHighContrast ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View
            style={[
              styles.arc,
              {
                borderColor: BrandColors.skyBlue,
                opacity: isDark ? 0.2 : 0.45,
              },
            ]}
          />
        </View>
      ) : null}

      <Header
        title={loading ? 'Información' : titleName}
        subtitle={loading ? undefined : 'Información del medicamento'}
        showBack
        onBack={() => navigation.goBack()}
        editorial
      />

      <Screen
        scroll
        padded
        contentStyle={{
          paddingBottom: scaleSpacing(Space[40]),
          maxWidth: readingWidth,
          alignSelf: 'center',
          width: '100%',
        }}
      >
        {loading ? (
          <View style={styles.loadingWrap} accessibilityLabel="Preparando información">
            <ActivityIndicator size="large" color={colors.primary} />
            <AppText
              variant="body"
              tone="secondary"
              style={{ marginTop: scaleSpacing(Space[16]), textAlign: 'center' }}
            >
              Preparando información…
            </AppText>
          </View>
        ) : null}

        {!loading && error ? (
          <View>
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
          </View>
        ) : null}

        {!loading && !error && info && !info.informationAvailable ? (
          <View>
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
          </View>
        ) : null}

        {!loading &&
        !error &&
        info &&
        info.informationAvailable &&
        !info.simplified ? (
          <View>
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
          </View>
        ) : null}

        {!loading &&
        !error &&
        info &&
        info.informationAvailable &&
        info.simplified ? (
          <View>
            <EditorialText
              variant="headline"
              accessibilityRole="header"
              style={{
                fontSize: scaleFont(compact ? 30 : 34),
                lineHeight: scaleFont(compact ? 36 : 40),
                flexShrink: 1,
                marginBottom: scaleSpacing(Space[4]),
              }}
            >
              {info.name}
            </EditorialText>

            <AppText variant="body" tone="secondary" style={{ flexShrink: 1 }}>
              Información del medicamento
            </AppText>

            {showGeneric ? (
              <AppText
                variant="body"
                tone="secondary"
                style={{ marginTop: scaleSpacing(Space[12]), flexShrink: 1 }}
              >
                {`Principio activo: ${info.genericName}`}
              </AppText>
            ) : null}

            {info.brandNames.length > 0 ? (
              <View style={{ marginTop: scaleSpacing(Space[12]) }}>
                <AppText variant="caption" tone="secondary" style={{ flexShrink: 1 }}>
                  También puede encontrarse como
                </AppText>
                <AppText
                  variant="body"
                  style={{ marginTop: 4, flexShrink: 1 }}
                >
                  {brandPreview.join(', ')}
                  {!brandsExpanded && brandExtra > 0 ? ` y ${brandExtra} más` : ''}
                </AppText>
                {brandExtra > 0 ? (
                  <Pressable
                    onPress={() => setBrandsExpanded((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel={brandsExpanded ? 'Ver menos marcas' : 'Ver más marcas'}
                    style={{ minHeight: minTouch * 0.7, justifyContent: 'center', marginTop: 4 }}
                  >
                    <AppText
                      variant="label"
                      style={{
                        color: isHighContrast ? colors.textPrimary : isDark ? colors.primary : BrandColors.teal,
                      }}
                    >
                      {brandsExpanded ? 'Ver menos' : 'Ver más'}
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <SectionDivider color={dividerColor} />

            {info.purpose?.trim() ? (
              <View>
                <AppText variant="label" style={{ marginBottom: scaleSpacing(Space[8]) }}>
                  ¿Para qué se utiliza?
                </AppText>
                <AppText
                  variant="body"
                  style={{
                    flexShrink: 1,
                    fontSize: scaleFont(17),
                    lineHeight: scaleFont(26),
                  }}
                >
                  {info.purpose.trim()}
                </AppText>
              </View>
            ) : null}

            {info.importantInformation.length > 0 ? (
              <>
                <SectionDivider color={dividerColor} />
                <View
                  style={[
                    styles.infoBlock,
                    {
                      backgroundColor: isHighContrast
                        ? colors.surface
                        : isDark
                          ? colors.surfaceElevated
                          : BrandColors.beige,
                      borderColor: isHighContrast ? colors.border : BrandColors.skyBlue,
                      borderWidth: isHighContrast ? 2 : 1,
                      padding: scaleSpacing(Space[16]),
                    },
                  ]}
                >
                  <View style={styles.sectionTitleRow}>
                    <Ionicons
                      name="information-circle-outline"
                      size={scaleFont(22)}
                      color={isHighContrast ? colors.textPrimary : isDark ? colors.primary : BrandColors.teal}
                    />
                    <AppText variant="label" style={{ flexShrink: 1, flex: 1 }}>
                      Información importante
                    </AppText>
                  </View>
                  <BulletList items={info.importantInformation} />
                </View>
              </>
            ) : null}

            {info.precautions.length > 0 ? (
              <>
                <SectionDivider color={dividerColor} />
                <View>
                  <AppText variant="label">Precauciones</AppText>
                  <BulletList items={info.precautions} />
                </View>
              </>
            ) : null}

            {info.dosageForms.length > 0 ? (
              <>
                <SectionDivider color={dividerColor} />
                <View>
                  <AppText
                    variant="label"
                    style={{ marginBottom: scaleSpacing(Space[12]) }}
                  >
                    Presentaciones
                  </AppText>
                  <AppText variant="body" tone="secondary" style={{ flexShrink: 1 }}>
                    {info.dosageForms.slice(0, 6).join(' · ')}
                    {info.dosageForms.length > 6
                      ? ` · y ${info.dosageForms.length - 6} más`
                      : ''}
                  </AppText>
                </View>
              </>
            ) : null}

            {canSpeak ? (
              <>
                <SectionDivider color={dividerColor} />
                <SpeakButton
                  id={`drug-info-${info.id ?? rxcui}`}
                  label="Escuchar información"
                  stopLabel="Detener"
                  text={() => buildDrugInfoSpeech(info)}
                />
              </>
            ) : null}

            <SectionDivider color={dividerColor} />

            <View
              style={[
                styles.noteBlock,
                {
                  backgroundColor: isHighContrast
                    ? colors.surface
                    : isDark
                      ? colors.surfaceElevated
                      : BrandColors.skyBlue,
                  borderColor: colors.border,
                  borderWidth: isHighContrast ? 2 : 0,
                  padding: scaleSpacing(Space[16]),
                },
              ]}
            >
              {friendlySourceLabel(info.source?.name) ? (
                <AppText variant="caption" tone="secondary" style={{ flexShrink: 1 }}>
                  {friendlySourceLabel(info.source?.name)}
                </AppText>
              ) : null}
              <AppText
                variant="caption"
                tone="secondary"
                style={{
                  marginTop: scaleSpacing(Space[8]),
                  flexShrink: 1,
                  lineHeight: scaleFont(20),
                }}
              >
                {info.disclaimer?.trim() || DEFAULT_DISCLAIMER}
              </AppText>
            </View>

            <Button
              title="Agregar medicamento"
              onPress={() => {
                const medName = (info.name || displayName || '').trim();
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
                navigation.navigate('AddMedication', { prefilled: { name: medName } });
              }}
              accessibilityLabel="Agregar medicamento"
              style={{ marginTop: scaleSpacing(Space[24]) }}
            />
            <Button
              title="Buscar otro medicamento"
              variant="outline"
              onPress={goSearchAgain}
              accessibilityLabel="Buscar otro medicamento"
              style={{ marginTop: scaleSpacing(Space[12]) }}
            />
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
  arc: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
    top: -60,
    right: -70,
    backgroundColor: 'transparent',
  },
  loadingWrap: {
    paddingVertical: 64,
    alignItems: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    marginVertical: Space[20],
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoBlock: {
    borderRadius: Radius.lg,
    width: '100%',
  },
  noteBlock: {
    borderRadius: Radius.lg,
    width: '100%',
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
