import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppText from '../AppText';
import OptionPickerModal from '../OptionPickerModal';
import { useAccessibility } from '../../context/AccessibilityContext';
import { FontFamily, Radius } from '../../theme/tokens';
import { hhmmToParts, partsToHhmm } from '../../utils/medicationFormHelpers';
import { scheduleClockAsset } from '../../utils/medicationFormAssets';
import { useMedicationFormColors } from './useMedicationFormColors';

type Props = {
  valueHhmm: string;
  onChange: (hhmm: string) => void;
  onRemove?: () => void;
  takeLabel?: string;
};

export default function TimeScheduleCard({ valueHhmm, onChange, onRemove, takeLabel }: Props) {
  const { minTouch, scaleFont } = useAccessibility();
  const palette = useMedicationFormColors();
  const [open, setOpen] = useState<'hour' | 'minute' | null>(null);
  const parts = useMemo(() => hhmmToParts(valueHhmm), [valueHhmm]);
  const minuteLabel = String(parts.minute).padStart(2, '0');
  const digitSize = scaleFont(28);

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
      {takeLabel || onRemove ? (
        <View style={styles.topRow}>
          <AppText variant="caption" style={{ color: palette.secondary, fontWeight: '700' }}>
            {takeLabel ?? 'Hora'}
          </AppText>
          {onRemove ? (
            <Pressable
              onPress={onRemove}
              accessibilityRole="button"
              accessibilityLabel="Eliminar hora"
              hitSlop={8}
              style={{
                minWidth: Math.max(40, minTouch * 0.75),
                minHeight: Math.max(40, minTouch * 0.75),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="trash-outline" size={18} color={palette.coral} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.mainRow}>
        <View style={[styles.clockBadge, { backgroundColor: palette.ice }]}>
          <Image
            source={scheduleClockAsset}
            style={[styles.clock, { backgroundColor: 'transparent' }]}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </View>

        <View style={styles.timeCluster}>
          <Pressable
            onPress={() => setOpen('hour')}
            accessibilityRole="button"
            accessibilityLabel={`Hora ${parts.hour12}. Cambiar hora`}
            style={[
              styles.digitTile,
              {
                minHeight: Math.max(56, minTouch),
                backgroundColor: palette.ice,
                borderColor: palette.border,
              },
            ]}
          >
            <AppText
              variant="h1"
              style={[
                styles.digit,
                {
                  color: palette.navy,
                  fontSize: digitSize,
                  lineHeight: digitSize + 6,
                },
              ]}
            >
              {parts.hour12}
            </AppText>
          </Pressable>

          <AppText
            variant="h1"
            style={{
              color: palette.navyMain,
              fontSize: digitSize,
              lineHeight: digitSize + 6,
              fontWeight: '700',
              marginTop: -2,
            }}
          >
            :
          </AppText>

          <Pressable
            onPress={() => setOpen('minute')}
            accessibilityRole="button"
            accessibilityLabel={`Minutos ${minuteLabel}. Cambiar minutos`}
            style={[
              styles.digitTile,
              {
                minHeight: Math.max(56, minTouch),
                backgroundColor: palette.ice,
                borderColor: palette.border,
              },
            ]}
          >
            <AppText
              variant="h1"
              style={[
                styles.digit,
                {
                  color: palette.navy,
                  fontSize: digitSize,
                  lineHeight: digitSize + 6,
                },
              ]}
            >
              {minuteLabel}
            </AppText>
          </Pressable>
        </View>

        <View
          style={[
            styles.period,
            {
              minHeight: Math.max(56, minTouch),
              backgroundColor: palette.ice,
              borderColor: palette.border,
            },
          ]}
        >
          {(['am', 'pm'] as const).map((period) => {
            const selected = parts.period === period;
            const label = period === 'am' ? 'AM' : 'PM';
            return (
              <Pressable
                key={period}
                onPress={() => setPeriod(period)}
                accessibilityRole="button"
                accessibilityLabel={period === 'am' ? 'a. m.' : 'p. m.'}
                accessibilityState={{ selected }}
                style={[
                  styles.periodChip,
                  {
                    backgroundColor: selected ? palette.navy : 'transparent',
                  },
                ]}
              >
                <AppText
                  variant="caption"
                  style={{
                    color: selected ? palette.onPrimary : palette.secondary,
                    fontWeight: '700',
                    fontSize: scaleFont(12),
                    letterSpacing: 0.4,
                  }}
                >
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

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
    borderRadius: Radius.xl,
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clockBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clock: {
    width: 34,
    height: 34,
  },
  timeCluster: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 0,
  },
  digitTile: {
    flex: 1,
    minWidth: 48,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  digit: {
    fontFamily: FontFamily.semiBold,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  period: {
    flexDirection: 'row',
    width: 108,
    borderRadius: 999,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  periodChip: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
});
