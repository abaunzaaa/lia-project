import React from 'react';
import { View, Image, StyleSheet, ScrollView, Pressable, Text, useWindowDimensions } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../types';
import {
  Header,
  AppText,
  EditorialText,
  SpeakButton,
} from '../components';
import MedicationHeroCard from '../components/medication-detail/MedicationHeroCard';
import MedicationScheduleCard from '../components/medication-detail/MedicationScheduleCard';
import MedicationInformationCard, {
  MedicationInfoRow,
} from '../components/medication-detail/MedicationInformationCard';
import {
  DETAIL_BUTTON_RADIUS,
  DETAIL_SCHEDULE_OVERLAP,
  DETAIL_STOCK_FILL,
  DETAIL_STOCK_RADIUS,
  LIA_QUESTION_BUBBLE_SOURCE,
  MEDICATION_CLOCK_SOURCE,
  MEDICATION_STOCK_IMAGE_SOURCE,
  MEDICATION_TABLET_BASE_SOURCE,
} from '../components/medication-detail/medicationDetailAssets';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useMedications } from '../context/MedicationContext';
import { useResponsive } from '../hooks/useResponsive';
import { brandInk } from '../theme/brand';
import { FontFamily, FontWeight, Space } from '../theme/tokens';
import { formatScheduleTimes, formatTime } from '../utils/helpers';
import { buildMedicationDetailsSpeech } from '../utils/speechPhrases';
import { parseDoseString, unitSingularLabel, isCountDoseUnit, presentationLabel, formatWeekdaysPhrase, mealLabel, formatShortDate } from '../utils/medicationFormHelpers';

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

  const { scaleFont, scaleSpacing, minTouch, buttonScale } = useAccessibility();
  const { colors, shadows, isHighContrast, isDark } = useTheme();
  const lightChrome = !isDark && !isHighContrast;
  const { horizontalPadding, contentMaxWidth } = useResponsive();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

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

  const usefulHeight = Math.max(height - insets.top - insets.bottom, 1);
  const heroMinHeight = Math.round(usefulHeight * 0.23);
  const ink = brandInk(isDark, isHighContrast, colors.textPrimary);
  const bubbleSize = Math.min(44, Math.max(38, scaleSpacing(40)));
  const stockFill = lightChrome ? DETAIL_STOCK_FILL : isDark ? colors.surfaceElevated : colors.surface;

  const infoRows: MedicationInfoRow[] = [];
  if (medication.presentation) {
    infoRows.push({
      key: 'presentation',
      label: 'Presentación',
      value: presentationLabel(medication.presentation),
      icon: 'cube-outline',
    });
  }
  if (medication.purpose) {
    infoRows.push({
      key: 'purpose',
      label: 'Para qué lo tomas',
      value: medication.purpose,
      icon: 'heart-outline',
    });
  }
  if (medication.weekdays && medication.weekdays.length > 0) {
    infoRows.push({
      key: 'days',
      label: 'Días',
      value: formatWeekdaysPhrase(medication.weekdays),
      icon: 'calendar-outline',
    });
  } else if (frequency) {
    infoRows.push({
      key: 'frequency',
      label: 'Frecuencia',
      value: frequency,
      icon: 'sync-outline',
    });
  }
  if (medication.mealRelation) {
    infoRows.push({
      key: 'meal',
      label: 'Con la comida',
      value: mealLabel(medication.mealRelation),
      icon: 'restaurant-outline',
    });
  }
  if (medication.startDate) {
    infoRows.push({
      key: 'start',
      label: 'Inicio',
      value: formatShortDate(medication.startDate),
      icon: 'calendar-outline',
    });
  }
  infoRows.push({
    key: 'end',
    label: 'Fin',
    value: medication.endDate ? formatShortDate(medication.endDate) : 'Sin fecha de finalización',
    icon: 'infinite-outline',
  });
  if (medication.description) {
    infoRows.push({
      key: 'notes',
      label: 'Indicaciones',
      value: medication.description,
      icon: 'document-text-outline',
    });
  }
  if (medication.reminderEnabled === false) {
    infoRows.push({
      key: 'reminder',
      label: 'Recordatorio',
      value: 'Desactivado en el teléfono',
      icon: 'notifications-off-outline',
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Detalle" showBack onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingBottom: scaleSpacing(Space[40]) + insets.bottom,
          maxWidth: contentMaxWidth,
          width: '100%',
          alignSelf: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginBottom: scaleSpacing(Space[16]) }}>
          <MedicationHeroCard
            name={medication.name}
            dosage={medication.dose}
            minHeight={heroMinHeight}
            artSource={MEDICATION_TABLET_BASE_SOURCE}
            overlapFooter={Boolean(scheduleLabel)}
          />
          {scheduleLabel ? (
            <View style={{ marginTop: -DETAIL_SCHEDULE_OVERLAP, zIndex: 2 }}>
              <MedicationScheduleCard
                scheduleLabel={scheduleLabel}
                clockSource={MEDICATION_CLOCK_SOURCE}
              />
            </View>
          ) : null}
        </View>

        {stockLabel ? (
          <View
            style={[
              styles.stockRow,
              {
                backgroundColor: lightChrome
                  ? '#E8ECEF'
                  : isHighContrast && !isDark
                    ? colors.surfaceElevated
                    : colors.surface,
                borderColor: isHighContrast ? colors.border : stockFill,
                borderWidth: isHighContrast ? 2 : 0,
                minHeight: Math.max(minTouch, 62),
                paddingHorizontal: scaleSpacing(Space[16]),
                marginBottom: scaleSpacing(Space[20]),
                gap: scaleSpacing(Space[12]),
              },
            ]}
            accessibilityRole="text"
            accessibilityLabel={stockLabel}
          >
            <Image
              source={MEDICATION_STOCK_IMAGE_SOURCE}
              style={styles.stockImage}
              resizeMode="contain"
              accessible={false}
              accessibilityIgnoresInvertColors
            />
            <AppText
              variant="body"
              style={{
                flex: 1,
                flexShrink: 1,
                color: ink,
                fontFamily: FontFamily.semiBold,
                fontWeight: FontWeight.semiBold,
              }}
            >
              {stockLabel}
            </AppText>
          </View>
        ) : null}

        <EditorialText
          variant="subhead"
          accessibilityRole="header"
          style={{
            color: ink,
            fontSize: scaleFont(22),
            lineHeight: scaleFont(28),
            marginBottom: scaleSpacing(Space[12]),
          }}
        >
          Información
        </EditorialText>

        <View style={{ marginBottom: scaleSpacing(Space[24]) }}>
          <MedicationInformationCard rows={infoRows} />
        </View>

        <View style={{ gap: scaleSpacing(Space[12]), marginBottom: scaleSpacing(Space[20]) }}>
          <Pressable
            onPress={openDrugChat}
            accessibilityRole="button"
            accessibilityLabel="Preguntar a LÍA"
            accessibilityHint="Abre el chat para preguntar sobre este medicamento"
            style={({ pressed }) => [
              styles.askButton,
              {
                minHeight: Math.max(minTouch, 60 * buttonScale),
                backgroundColor: colors.primary,
                borderWidth: isHighContrast ? 2 : 0,
                borderColor: colors.border,
                opacity: pressed ? 0.82 : 1,
              },
              !isHighContrast ? shadows.sm : null,
            ]}
          >
            <View
              style={[styles.askButtonContent, { gap: 10 }]}
              pointerEvents="none"
            >
              <View
                style={[styles.askIconSlot, { width: bubbleSize, height: bubbleSize }]}
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Image
                  source={LIA_QUESTION_BUBBLE_SOURCE}
                  style={{ width: bubbleSize, height: bubbleSize, backgroundColor: 'transparent' }}
                  resizeMode="contain"
                  accessible={false}
                  accessibilityIgnoresInvertColors
                />
              </View>
              <Text
                numberOfLines={2}
                textBreakStrategy="simple"
                style={[
                  styles.askButtonText,
                  {
                    fontSize: scaleFont(17),
                    lineHeight: scaleFont(22),
                    color: colors.onPrimary,
                  },
                ]}
              >
                Preguntar a LÍA
              </Text>
            </View>
          </Pressable>
          <SpeakButton
            id={`med-detail-${medication.id}`}
            label="Escuchar información"
            stopLabel="Detener lectura"
            text={() => buildMedicationDetailsSpeech(medication)}
            style={{
              alignSelf: 'stretch',
              justifyContent: 'center',
              minHeight: Math.max(minTouch, 56 * buttonScale),
              borderRadius: DETAIL_BUTTON_RADIUS,
              paddingVertical: scaleSpacing(Space[12]),
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: DETAIL_STOCK_RADIUS,
    width: '100%',
  },
  askButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    borderRadius: DETAIL_BUTTON_RADIUS,
    paddingHorizontal: 14,
    overflow: 'visible',
  },
  askButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  askIconSlot: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  askButtonText: {
    flexShrink: 1,
    textAlign: 'center',
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
  },
  stockImage: {
    width: 36,
    height: 36,
    flexShrink: 0,
    backgroundColor: 'transparent',
  },
});
