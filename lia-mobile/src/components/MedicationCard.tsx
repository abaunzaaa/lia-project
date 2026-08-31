import React from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily, FontWeight, Radius, Space } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { BrandColors, liaCardBorder } from '../theme/brand';
import { formatScheduleTimes, formatTime } from '../utils/helpers';
import { parseDoseString, unitSingularLabel, isCountDoseUnit } from '../utils/medicationFormHelpers';
import { getMedicationImageScale, getMedicationImageSource, MEDICATION_IMAGE_SLOT } from '../config/medicationImages';
import { Medication } from '../types';
import AppText from './AppText';

interface MedicationCardProps {
  medication: Medication;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
  nextTime?: string | null;
  missed?: number;
}

const FREQUENCY_LABELS: Record<string, string> = {
  '8h': 'Cada 8 horas',
  '12h': 'Cada 12 horas',
  '24h': 'Todos los días',
  '2x': 'Dos veces al día',
  '3x': 'Tres veces al día',
  prn: 'Según necesidad',
};

function inventoryLabel(medication: Medication): string | null {
  if (typeof medication.quantity !== 'number' || !Number.isFinite(medication.quantity)) {
    return null;
  }
  const qty = Math.max(0, Math.floor(medication.quantity));
  const parsed = parseDoseString(medication.dose || '');
  if (isCountDoseUnit(parsed.unit)) {
    return `Disponible: ${qty} ${unitSingularLabel(parsed.unit)}`;
  }
  return `Quedan: ${qty} dosis`;
}

export default function MedicationCard({
  medication,
  onPress,
  onEdit,
  onDelete,
  showActions = true,
  nextTime,
  missed = 0,
}: MedicationCardProps) {
  const { colors, isHighContrast, isDark } = useTheme();
  const { minTouch, scaleSpacing, scaleFont } = useAccessibility();
  const lightChrome = !isDark && !isHighContrast;
  const hasMissed = missed > 0;
  const [imageFailed, setImageFailed] = React.useState(false);
  const showImage = Boolean(medication.imageUrl) && !imageFailed;

  React.useEffect(() => {
    setImageFailed(false);
  }, [medication.imageUrl]);

  const frequency = medication.frequency
    ? FREQUENCY_LABELS[medication.frequency] || medication.frequency
    : '';
  const scheduleFallback =
    medication.schedules?.length > 0
      ? formatScheduleTimes(medication.schedules.map((s) => s.time))
      : medication.time
        ? formatTime(medication.time)
        : '';
  const nextLabel = nextTime
    ? `Próxima toma: ${nextTime}`
    : scheduleFallback
      ? `Horario: ${scheduleFallback}`
      : null;
  const stock = inventoryLabel(medication);
  const ink = lightChrome ? BrandColors.navy : colors.textPrimary;
  const muted = lightChrome ? BrandColors.teal : colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${medication.name}, ${medication.dose}.${frequency ? ` ${frequency}.` : ''}${nextLabel ? ` ${nextLabel}.` : ''}${stock ? ` ${stock}.` : ''}`}
      style={({ pressed }) => [
        styles.card,
        {
          marginBottom: scaleSpacing(Space[16]),
          backgroundColor: lightChrome ? '#FFFFFF' : colors.surface,
          borderColor: liaCardBorder(lightChrome, colors.border),
          borderWidth: isHighContrast ? 2 : 1,
          opacity: pressed ? 0.96 : 1,
        },
      ]}
    >
      <View style={styles.bodyRow}>
        <View style={styles.copy}>
          <AppText
            variant="h3"
            numberOfLines={2}
            style={{ color: ink, fontWeight: '600' }}
          >
            {medication.name}
          </AppText>
          {medication.dose ? (
            <AppText
              variant="caption"
              numberOfLines={1}
              style={{ color: muted, marginTop: 2 }}
            >
              {medication.dose}
            </AppText>
          ) : null}
          {frequency ? (
            <AppText
              variant="caption"
              numberOfLines={1}
              style={{ color: muted, marginTop: 2 }}
            >
              {frequency}
            </AppText>
          ) : null}
          {hasMissed || nextLabel ? (
            <AppText
              variant="caption"
              numberOfLines={2}
              style={{ color: muted, marginTop: 2 }}
            >
              {hasMissed ? 'Esta toma quedó sin registrar' : nextLabel}
            </AppText>
          ) : null}
          {stock ? (
            <AppText
              variant="caption"
              numberOfLines={1}
              style={{ color: muted, marginTop: 2 }}
            >
              {stock}
            </AppText>
          ) : null}

          <View style={[styles.status, { marginTop: 8 }]}>
            <Ionicons
              name={hasMissed ? 'alert-circle-outline' : 'checkmark-circle-outline'}
              size={16}
              color={ink}
            />
            <AppText
              variant="caption"
              numberOfLines={1}
              style={{ flex: 1, color: ink, fontWeight: '600' }}
            >
              {hasMissed
                ? missed === 1
                  ? '1 toma sin registrar'
                  : `${missed} tomas sin registrar`
                : 'Todo al día'}
            </AppText>
          </View>
        </View>

        <View style={styles.art} pointerEvents="none">
          <Image
            source={
              showImage && medication.imageUrl
                ? { uri: medication.imageUrl }
                : getMedicationImageSource(medication.name)
            }
            style={[
              styles.artImage,
              { transform: [{ scale: getMedicationImageScale(medication.name) }], backgroundColor: 'transparent' },
            ]}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            onError={() => setImageFailed(true)}
          />
        </View>
      </View>

      {showActions ? (
        <View style={styles.actions}>
          {onEdit ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onEdit();
              }}
              accessibilityRole="button"
              accessibilityLabel="Editar medicamento"
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  minHeight: Math.max(minTouch, 44),
                  backgroundColor: lightChrome ? BrandColors.white : colors.surfaceElevated,
                  borderColor: lightChrome ? BrandColors.skyBlue : colors.border,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <Ionicons name="create-outline" size={scaleFont(20)} color={ink} />
              <AppText
                variant="button"
                style={{
                  color: ink,
                  fontFamily: FontFamily.semiBold,
                  fontWeight: FontWeight.semiBold,
                }}
              >
                Editar
              </AppText>
            </Pressable>
          ) : null}
          {onDelete ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onDelete();
              }}
              accessibilityRole="button"
              accessibilityLabel="Eliminar medicamento"
              accessibilityHint="Quita este medicamento de tu lista activa"
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  minHeight: Math.max(minTouch, 44),
                  backgroundColor: isHighContrast ? colors.surface : colors.errorSoft,
                  borderColor: isHighContrast ? colors.border : colors.errorSoft,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <Ionicons name="trash-outline" size={scaleFont(20)} color={colors.error} />
              <AppText
                variant="button"
                style={{
                  color: colors.error,
                  fontFamily: FontFamily.semiBold,
                  fontWeight: FontWeight.semiBold,
                }}
              >
                Eliminar
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    minWidth: 0,
    borderRadius: 24,
    padding: 16,
    minHeight: 168,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 2,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 118,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  art: {
    width: MEDICATION_IMAGE_SLOT.width,
    height: MEDICATION_IMAGE_SLOT.height,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  artImage: {
    width: MEDICATION_IMAGE_SLOT.width,
    height: MEDICATION_IMAGE_SLOT.height,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
