import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppText from '../AppText';
import OptionPickerModal from '../OptionPickerModal';
import { useAccessibility } from '../../context/AccessibilityContext';
import { Radius, Space } from '../../theme/tokens';
import { hhmmToParts, partsToHhmm } from '../../utils/medicationFormHelpers';
import { useMedicationFormColors } from './useMedicationFormColors';

type Props = {
  valueHhmm: string;
  onChange: (hhmm: string) => void;
  onRemove?: () => void;
};

export default function TimeScheduleCard({ valueHhmm, onChange, onRemove }: Props) {
  const { minTouch, scaleFont } = useAccessibility();
  const palette = useMedicationFormColors();
  const [open, setOpen] = useState<'hour' | 'minute' | null>(null);
  const parts = useMemo(() => hhmmToParts(valueHhmm), [valueHhmm]);
  const minuteLabel = String(parts.minute).padStart(2, '0');

  const setPeriod = (period: 'am' | 'pm') => {
    onChange(partsToHhmm({ ...parts, period }));
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
          borderWidth: palette.borderWidth,
        },
      ]}
    >
      <View style={styles.timeBlock}>
        <Pressable
          onPress={() => setOpen('hour')}
          accessibilityRole="button"
          accessibilityLabel={`Hora ${parts.hour12}. Cambiar hora`}
          style={({ pressed }) => [
            styles.timeChip,
            {
              borderColor: palette.border,
              backgroundColor: palette.ice,
              opacity: pressed ? 0.88 : 1,
              minHeight: Math.max(52, minTouch),
            },
          ]}
        >
          <AppText
            variant="h1"
            style={{ color: palette.navy, fontWeight: '700', fontSize: scaleFont(28) }}
          >
            {parts.hour12}
          </AppText>
        </Pressable>
        <AppText
          variant="h1"
          style={{ color: palette.navy, fontWeight: '700', fontSize: scaleFont(28) }}
        >
          :
        </AppText>
        <Pressable
          onPress={() => setOpen('minute')}
          accessibilityRole="button"
          accessibilityLabel={`Minutos ${minuteLabel}. Cambiar minutos`}
          style={({ pressed }) => [
            styles.timeChip,
            {
              borderColor: palette.border,
              backgroundColor: palette.ice,
              opacity: pressed ? 0.88 : 1,
              minHeight: Math.max(52, minTouch),
            },
          ]}
        >
          <AppText
            variant="h1"
            style={{ color: palette.navy, fontWeight: '700', fontSize: scaleFont(28) }}
          >
            {minuteLabel}
          </AppText>
        </Pressable>
      </View>

      <View style={styles.periodCol}>
        {(['am', 'pm'] as const).map((period) => {
          const selected = parts.period === period;
          const label = period === 'am' ? 'a. m.' : 'p. m.';
          return (
            <Pressable
              key={period}
              onPress={() => setPeriod(period)}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              style={{
                minHeight: Math.max(40, minTouch * 0.75),
                minWidth: 72,
                paddingHorizontal: 10,
                borderRadius: Radius.md,
                backgroundColor: selected ? palette.navy : palette.ice,
                borderWidth: 1,
                borderColor: selected ? palette.navy : palette.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText
                variant="caption"
                style={{
                  color: selected ? palette.onPrimary : palette.navy,
                  fontWeight: '700',
                }}
              >
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {onRemove ? (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel="Eliminar hora"
          hitSlop={8}
          style={{
            minWidth: Math.max(48, minTouch),
            minHeight: Math.max(48, minTouch),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="trash-outline" size={22} color={palette.coral} />
        </Pressable>
      ) : (
        <View style={{ width: Space[8] }} />
      )}

      <OptionPickerModal
        visible={open === 'hour'}
        title="Hora"
        selectedValue={String(parts.hour12)}
        options={Array.from({ length: 12 }, (_, i) => ({
          value: String(i + 1),
          label: String(i + 1),
        }))}
        onSelect={(value) => {
          onChange(partsToHhmm({ ...parts, hour12: parseInt(value, 10) }));
          setOpen(null);
        }}
        onClose={() => setOpen(null)}
      />
      <OptionPickerModal
        visible={open === 'minute'}
        title="Minutos"
        selectedValue={String(parts.minute)}
        options={Array.from({ length: 60 }, (_, i) => i).map((minute) => ({
          value: String(minute),
          label: String(minute).padStart(2, '0'),
        }))}
        onSelect={(value) => {
          onChange(partsToHhmm({ ...parts, minute: parseInt(value, 10) }));
          setOpen(null);
        }}
        onClose={() => setOpen(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.xl,
    padding: 12,
    gap: 10,
  },
  timeBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeChip: {
    minWidth: 64,
    paddingHorizontal: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodCol: {
    gap: 6,
  },
});
