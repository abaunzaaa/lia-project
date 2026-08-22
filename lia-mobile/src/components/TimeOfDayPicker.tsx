import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors } from '../theme/brand';
import { Radius, Space } from '../theme/tokens';
import AppText from './AppText';
import OptionPickerModal from './OptionPickerModal';
import {
  TimeParts12,
  hhmmToParts,
  partsToHhmm,
  MINUTE_PRESETS,
} from '../utils/medicationFormHelpers';

type Props = {
  label: string;
  valueHhmm: string;
  onChange: (hhmm: string) => void;
  onRemove?: () => void;
};

export default function TimeOfDayPicker({ label, valueHhmm, onChange, onRemove }: Props) {
  const { colors, isHighContrast, isDark } = useTheme();
  const { scaleSpacing, minTouch, scaleFont, isSeniorMode } = useAccessibility();
  const { isSmallPhone } = useResponsive();
  const [open, setOpen] = useState<'hour' | 'minute' | 'period' | null>(null);

  const parts = useMemo(() => hhmmToParts(valueHhmm), [valueHhmm]);

  const update = (patch: Partial<TimeParts12>) => {
    onChange(partsToHhmm({ ...parts, ...patch }));
  };

  const fieldBg = isHighContrast
    ? colors.surface
    : isDark
      ? colors.surfaceElevated
      : BrandColors.white;

  const Chip = ({
    text,
    onPress,
    a11y,
  }: {
    text: string;
    onPress: () => void;
    a11y: string;
  }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [
        styles.chip,
        {
          minHeight: minTouch,
          backgroundColor: fieldBg,
          borderColor: colors.border,
          borderWidth: isHighContrast ? 2 : 1,
          opacity: pressed ? 0.88 : 1,
          paddingHorizontal: scaleSpacing(Space[12]),
          flex: isSmallPhone || isSeniorMode ? undefined : 1,
          minWidth: isSmallPhone || isSeniorMode ? '30%' : 0,
        },
      ]}
    >
      <AppText variant="body" style={{ fontWeight: '600', fontSize: scaleFont(16) }}>
        {text}
      </AppText>
      <Ionicons
        name="chevron-down"
        size={scaleFont(16)}
        color={isHighContrast ? colors.textPrimary : isDark ? colors.primary : BrandColors.teal}
      />
    </Pressable>
  );

  const minuteLabel = String(parts.minute).padStart(2, '0');
  const periodLabel = parts.period === 'am' ? 'a. m.' : 'p. m.';

  return (
    <View style={{ marginBottom: scaleSpacing(Space[16]), width: '100%' }}>
      <View style={styles.labelRow}>
        <AppText variant="label" style={{ flex: 1, flexShrink: 1 }}>
          {label}
        </AppText>
        {onRemove ? (
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={`Eliminar ${label}`}
            style={{ minHeight: minTouch * 0.8, justifyContent: 'center' }}
          >
            <AppText
              variant="caption"
              style={{ color: isHighContrast ? colors.textPrimary : isDark ? colors.primary : BrandColors.teal }}
            >
              Quitar
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <View
        style={[
          styles.row,
          (isSmallPhone || isSeniorMode) && styles.rowWrap,
          { gap: scaleSpacing(Space[8]) },
        ]}
      >
        <Chip
          text={String(parts.hour12)}
          onPress={() => setOpen('hour')}
          a11y={`Hora ${parts.hour12}`}
        />
        <AppText variant="h3" style={{ alignSelf: 'center' }}>
          :
        </AppText>
        <Chip text={minuteLabel} onPress={() => setOpen('minute')} a11y={`Minutos ${minuteLabel}`} />
        <Chip text={periodLabel} onPress={() => setOpen('period')} a11y={`Periodo ${periodLabel}`} />
      </View>

      <OptionPickerModal
        visible={open === 'hour'}
        title="Hora"
        selectedValue={String(parts.hour12)}
        options={Array.from({ length: 12 }, (_, i) => ({
          value: String(i + 1),
          label: String(i + 1),
        }))}
        onSelect={(v) => {
          update({ hour12: parseInt(v, 10) });
          setOpen(null);
        }}
        onClose={() => setOpen(null)}
      />

      <OptionPickerModal
        visible={open === 'minute'}
        title="Minutos"
        selectedValue={
          MINUTE_PRESETS.includes(parts.minute as (typeof MINUTE_PRESETS)[number])
            ? String(parts.minute)
            : 'other'
        }
        options={[
          ...MINUTE_PRESETS.map((m) => ({
            value: String(m),
            label: String(m).padStart(2, '0'),
          })),
          ...Array.from({ length: 60 }, (_, i) => i)
            .filter((m) => !(MINUTE_PRESETS as readonly number[]).includes(m))
            .map((m) => ({
              value: String(m),
              label: String(m).padStart(2, '0'),
            })),
        ]}
        onSelect={(v) => {
          update({ minute: parseInt(v, 10) });
          setOpen(null);
        }}
        onClose={() => setOpen(null)}
      />

      <OptionPickerModal
        visible={open === 'period'}
        title="Periodo"
        selectedValue={parts.period}
        options={[
          { value: 'am', label: 'a. m.' },
          { value: 'pm', label: 'p. m.' },
        ]}
        onSelect={(v) => {
          update({ period: v as 'am' | 'pm' });
          setOpen(null);
        }}
        onClose={() => setOpen(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Space[8],
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  rowWrap: {
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    borderRadius: Radius.lg,
  },
});
