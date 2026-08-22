import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types';
import {
  Header,
  Button,
  AppText,
  EditorialText,
  SurfaceCard,
  SpeakButton,
} from '../components';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useMedications } from '../context/MedicationContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors } from '../theme/brand';
import { Space } from '../theme/tokens';
import { formatScheduleTimes, formatTime } from '../utils/helpers';
import { buildMedicationDetailsSpeech } from '../utils/speechPhrases';
import { parseDoseString, unitSingularLabel, isCountDoseUnit } from '../utils/medicationFormHelpers';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'MedicationDetail'>;
  route: RouteProp<RootStackParamList, 'MedicationDetail'>;
};

const FREQUENCY_LABELS: Record<string, string> = {
  '8h': 'Cada 8 horas',
  '12h': 'Cada 12 horas',
  '24h': 'Todos los días',
  '2x': 'Dos veces al día',
  '3x': 'Tres veces al día',
  prn: 'Según necesidad',
};

export default function MedicationDetailScreen({ navigation, route }: Props) {
  const { medication: initial } = route.params;
  const { medications } = useMedications();
  const medication = medications.find((m) => m.id === initial.id) || initial;

  const { scaleFont, scaleSpacing } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const { horizontalPadding, contentMaxWidth } = useResponsive();

  const openDrugChat = () => {
    navigation.navigate('DrugChat', {
      name: medication.name,
      registeredDose: medication.dose || undefined,
    });
  };

  const scheduleLabel =
    medication.schedules?.length > 0
      ? formatScheduleTimes(medication.schedules.map((s) => s.time))
      : medication.time
        ? formatTime(medication.time)
        : '';

  const frequency = medication.frequency
    ? FREQUENCY_LABELS[medication.frequency] || medication.frequency
    : '';

  const parsed = parseDoseString(medication.dose || '');
  const stockLabel =
    medication.quantity > 0
      ? isCountDoseUnit(parsed.unit)
        ? `Quedan ${medication.quantity} ${unitSingularLabel(parsed.unit)}`
        : `Cantidad disponible: ${medication.quantity}`
      : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Detalle" showBack onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingBottom: scaleSpacing(Space[40]),
          maxWidth: contentMaxWidth,
          width: '100%',
          alignSelf: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        {!isHighContrast ? (
          <View
            pointerEvents="none"
            style={[
              styles.halo,
              {
                backgroundColor: isDark ? 'rgba(200,217,230,0.12)' : BrandColors.skyBlue,
                opacity: isDark ? 1 : 0.45,
              },
            ]}
          />
        ) : null}

        <View style={{ marginBottom: scaleSpacing(Space[24]), alignItems: 'flex-start' }}>
          <EditorialText
            variant="subhead"
            style={{
              fontSize: scaleFont(28),
              lineHeight: scaleFont(34),
              marginBottom: scaleSpacing(Space[8]),
            }}
          >
            {medication.name}
          </EditorialText>
          <AppText variant="bodyLarge" tone="secondary">
            {medication.dose}
          </AppText>
        </View>

        {scheduleLabel ? (
          <SurfaceCard
            variant="emphasis"
            style={{
              marginBottom: scaleSpacing(Space[20]),
              borderTopWidth: isHighContrast ? 2 : 3,
              borderTopColor: isHighContrast ? colors.border : BrandColors.teal,
            }}
          >
            <AppText
              variant="overline"
              style={{
                color: isHighContrast ? colors.textSecondary : BrandColors.teal,
                marginBottom: scaleSpacing(Space[8]),
              }}
            >
              Horarios
            </AppText>
            <AppText
              variant="h2"
              style={{ color: isHighContrast ? colors.textPrimary : BrandColors.navy }}
            >
              {scheduleLabel}
            </AppText>
          </SurfaceCard>
        ) : null}

        {stockLabel ? (
          <View
            style={[
              styles.stockRow,
              {
                backgroundColor: isHighContrast
                  ? colors.surface
                  : isDark
                    ? colors.surfaceElevated
                    : BrandColors.beige,
                borderColor: isHighContrast ? colors.border : BrandColors.skyBlue,
                borderWidth: isHighContrast ? 2 : 1,
                padding: scaleSpacing(Space[16]),
                marginBottom: scaleSpacing(Space[20]),
              },
            ]}
            accessibilityLabel={stockLabel}
          >
            <Ionicons
              name="file-tray-full-outline"
              size={scaleFont(28)}
              color={isHighContrast ? colors.textPrimary : BrandColors.teal}
            />
            <AppText variant="body" style={{ flex: 1, flexShrink: 1, fontWeight: '600' }}>
              {stockLabel}
            </AppText>
          </View>
        ) : null}

        <AppText variant="label" style={{ marginBottom: scaleSpacing(Space[12]) }}>
          Información
        </AppText>

        <View style={{ marginBottom: scaleSpacing(Space[24]), gap: scaleSpacing(Space[16]) }}>
          {frequency ? <InfoBlock label="Frecuencia" value={frequency} colors={colors} /> : null}
          {medication.startDate ? (
            <InfoBlock label="Inicio" value={medication.startDate} colors={colors} />
          ) : null}
          {medication.endDate ? (
            <InfoBlock label="Fin" value={medication.endDate} colors={colors} />
          ) : null}
          {medication.description ? (
            <InfoBlock label="Indicaciones" value={medication.description} colors={colors} />
          ) : null}
        </View>

        <View style={{ gap: scaleSpacing(Space[12]), marginBottom: scaleSpacing(Space[20]) }}>
          <Button
            title="Preguntar a LIA"
            variant="secondary"
            onPress={openDrugChat}
            accessibilityLabel="Preguntar a LIA"
            accessibilityHint="Abre el chat para preguntar sobre este medicamento"
            icon={
              <Ionicons
                name="chatbubble-ellipses"
                size={scaleFont(20)}
                color={colors.onPrimary}
              />
            }
          />
          <SpeakButton
            id={`med-detail-${medication.id}`}
            label="Escuchar información"
            stopLabel="Detener lectura"
            text={() => buildMedicationDetailsSpeech(medication)}
            style={{ alignSelf: 'stretch', justifyContent: 'center' }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function InfoBlock({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: { textSecondary: string; textPrimary: string; border: string };
}) {
  return (
    <View
      style={{
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
        paddingBottom: 12,
      }}
    >
      <AppText variant="caption" tone="secondary" style={{ marginBottom: 4 }}>
        {label}
      </AppText>
      <AppText variant="body" style={{ fontWeight: '600' }}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  halo: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -40,
    right: -50,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    width: '100%',
  },
});
