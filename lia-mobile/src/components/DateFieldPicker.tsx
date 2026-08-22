import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { BrandColors } from '../theme/brand';
import { Radius, Space } from '../theme/tokens';
import AppText from './AppText';
import OptionPickerModal from './OptionPickerModal';
import { formatShortDate } from '../utils/medicationFormHelpers';

type Props = {
  label: string;
  valueYmd: string;
  onChange: (ymd: string) => void;
  minimumYmd?: string;
};

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export default function DateFieldPicker({ label, valueYmd, onChange, minimumYmd }: Props) {
  const { colors, isHighContrast, isDark } = useTheme();
  const { scaleSpacing, minTouch, scaleFont } = useAccessibility();
  const [open, setOpen] = useState<'day' | 'month' | 'year' | null>(null);

  const { y, m, d } = useMemo(() => {
    const parts = valueYmd.split('-').map((n) => parseInt(n, 10));
    return {
      y: parts[0] || new Date().getFullYear(),
      m: parts[1] || 1,
      d: parts[2] || 1,
    };
  }, [valueYmd]);

  const commit = (ny: number, nm: number, nd: number) => {
    const maxD = daysInMonth(ny, nm);
    const day = Math.min(nd, maxD);
    const next = `${ny}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (minimumYmd && next < minimumYmd) {
      onChange(minimumYmd);
      return;
    }
    onChange(next);
  };

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 16 }, (_, i) => now - 1 + i);
  }, []);

  const months = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];

  return (
    <View style={{ marginBottom: scaleSpacing(Space[16]), width: '100%' }}>
      <AppText variant="label" style={{ marginBottom: scaleSpacing(Space[8]) }}>
        {label}
      </AppText>
      <Pressable
        onPress={() => setOpen('day')}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatShortDate(valueYmd)}`}
        style={({ pressed }) => [
          styles.field,
          {
            minHeight: minTouch,
            backgroundColor: isHighContrast
              ? colors.surface
              : isDark
                ? colors.surfaceElevated
                : BrandColors.white,
            borderColor: colors.border,
            borderWidth: isHighContrast ? 2 : 1,
            opacity: pressed ? 0.9 : 1,
            paddingHorizontal: scaleSpacing(Space[16]),
          },
        ]}
      >
        <AppText variant="body" style={{ flex: 1, flexShrink: 1, fontSize: scaleFont(16) }}>
          {formatShortDate(valueYmd)}
        </AppText>
        <Ionicons
          name="calendar-outline"
          size={scaleFont(20)}
          color={isHighContrast ? colors.textPrimary : BrandColors.teal}
        />
      </Pressable>

      <OptionPickerModal
        visible={open === 'day'}
        title="Día"
        selectedValue={String(d)}
        options={Array.from({ length: daysInMonth(y, m) }, (_, i) => ({
          value: String(i + 1),
          label: String(i + 1),
        }))}
        onSelect={(v) => {
          commit(y, m, parseInt(v, 10));
          setOpen('month');
        }}
        onClose={() => setOpen(null)}
      />
      <OptionPickerModal
        visible={open === 'month'}
        title="Mes"
        selectedValue={String(m)}
        options={months.map((name, idx) => ({
          value: String(idx + 1),
          label: name,
        }))}
        onSelect={(v) => {
          commit(y, parseInt(v, 10), d);
          setOpen('year');
        }}
        onClose={() => setOpen(null)}
      />
      <OptionPickerModal
        visible={open === 'year'}
        title="Año"
        selectedValue={String(y)}
        options={years.map((yy) => ({ value: String(yy), label: String(yy) }))}
        onSelect={(v) => {
          commit(parseInt(v, 10), m, d);
          setOpen(null);
        }}
        onClose={() => setOpen(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    gap: 12,
    width: '100%',
  },
});
