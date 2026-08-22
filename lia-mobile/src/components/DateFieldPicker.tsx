import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { BrandColors } from '../theme/brand';
import { Radius, Space } from '../theme/tokens';
import AppText from './AppText';
import { formatShortDate } from '../utils/medicationFormHelpers';

const FUTURE_YEARS = 10;
const PAST_YEARS = 1;
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTHS = [
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

type Props = {
  label: string;
  valueYmd: string;
  onChange: (ymd: string) => void;
  minimumYmd?: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toYmd(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const parts = ymd.split('-').map((n) => parseInt(n, 10));
  const now = new Date();
  return {
    y: parts[0] || now.getFullYear(),
    m: parts[1] || 1,
    d: parts[2] || 1,
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function mondayFirstOffset(year: number, month: number): number {
  const sundayIndex = new Date(year, month - 1, 1).getDay();
  return (sundayIndex + 6) % 7;
}

function shiftMonth(year: number, month: number, delta: number): { y: number; m: number } {
  const dt = new Date(year, month - 1 + delta, 1);
  return { y: dt.getFullYear(), m: dt.getMonth() + 1 };
}

function monthKey(year: number, month: number): number {
  return year * 12 + month;
}

export default function DateFieldPicker({ label, valueYmd, onChange, minimumYmd }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, isHighContrast, isDark } = useTheme();
  const { scaleSpacing, minTouch, scaleFont } = useAccessibility();
  const [open, setOpen] = useState(false);
  const [pickingYear, setPickingYear] = useState(false);

  const selected = useMemo(() => parseYmd(valueYmd), [valueYmd]);
  const [viewY, setViewY] = useState(selected.y);
  const [viewM, setViewM] = useState(selected.m);

  const bounds = useMemo(() => {
    const now = new Date();
    const max = toYmd(now.getFullYear() + FUTURE_YEARS, 12, 31);
    const fallbackMin = toYmd(now.getFullYear() - PAST_YEARS, 1, 1);
    const min = minimumYmd && minimumYmd > fallbackMin ? minimumYmd : fallbackMin;
    return { min, max };
  }, [minimumYmd]);

  const years = useMemo(() => {
    const minY = parseYmd(bounds.min).y;
    const maxY = parseYmd(bounds.max).y;
    const list: number[] = [];
    for (let y = minY; y <= maxY; y += 1) list.push(y);
    return list;
  }, [bounds]);

  const openCalendar = () => {
    setViewY(selected.y);
    setViewM(selected.m);
    setPickingYear(false);
    setOpen(true);
  };

  const commitDay = (day: number) => {
    let next = toYmd(viewY, viewM, day);
    if (next < bounds.min) next = bounds.min;
    if (next > bounds.max) next = bounds.max;
    onChange(next);
    setOpen(false);
  };

  const canPrev = monthKey(viewY, viewM) > monthKey(parseYmd(bounds.min).y, parseYmd(bounds.min).m);
  const canNext = monthKey(viewY, viewM) < monthKey(parseYmd(bounds.max).y, parseYmd(bounds.max).m);

  const goMonth = (delta: number) => {
    if (delta < 0 && !canPrev) return;
    if (delta > 0 && !canNext) return;
    const next = shiftMonth(viewY, viewM, delta);
    setViewY(next.y);
    setViewM(next.m);
  };

  const blanks = mondayFirstOffset(viewY, viewM);
  const dim = daysInMonth(viewY, viewM);
  const cells: Array<number | null> = [
    ...Array.from({ length: blanks }, () => null),
    ...Array.from({ length: dim }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const fieldBg = isHighContrast
    ? colors.surface
    : isDark
      ? colors.surfaceElevated
      : BrandColors.white;
  const sheetBg = isHighContrast
    ? colors.surface
    : isDark
      ? colors.surfaceElevated
      : BrandColors.white;

  const dayFont = Math.min(scaleFont(15), 18);
  const navHit = Math.max(44, Math.min(minTouch, 52));

  return (
    <View style={{ marginBottom: scaleSpacing(Space[16]), width: '100%' }}>
      <AppText variant="label" style={{ marginBottom: scaleSpacing(Space[8]) }}>
        {label}
      </AppText>
      <Pressable
        onPress={openCalendar}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatShortDate(valueYmd)}`}
        accessibilityHint="Abre el calendario para elegir una fecha"
        style={({ pressed }) => [
          styles.field,
          {
            minHeight: minTouch,
            backgroundColor: fieldBg,
            borderColor: colors.border,
            borderWidth: isHighContrast ? 2 : 1,
            opacity: pressed ? 0.9 : 1,
            paddingHorizontal: scaleSpacing(Space[16]),
          },
        ]}
      >
        <AppText variant="body" style={{ flexShrink: 1, fontSize: scaleFont(16) }}>
          {formatShortDate(valueYmd)}
        </AppText>
        <Ionicons
          name="calendar-outline"
          size={scaleFont(20)}
          color={isHighContrast ? colors.textPrimary : isDark ? colors.primary : BrandColors.teal}
        />
      </Pressable>

      <Modal transparent visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.sheet,
                  {
                    backgroundColor: sheetBg,
                    paddingBottom: Math.max(insets.bottom, scaleSpacing(Space[16])),
                  },
                ]}
              >
                <View style={styles.handleRow}>
                  <View
                    style={[
                      styles.handle,
                      { backgroundColor: isHighContrast ? colors.border : BrandColors.skyBlue },
                    ]}
                  />
                </View>

                <View
                  style={[
                    styles.navRow,
                    { paddingHorizontal: scaleSpacing(Space[12]), marginBottom: scaleSpacing(Space[12]) },
                  ]}
                >
                  <Pressable
                    onPress={() => goMonth(-1)}
                    disabled={!canPrev}
                    accessibilityRole="button"
                    accessibilityLabel="Mes anterior"
                    style={[styles.navBtn, { minWidth: navHit, minHeight: navHit, opacity: canPrev ? 1 : 0.35 }]}
                  >
                    <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
                  </Pressable>

                  <Pressable
                    onPress={() => setPickingYear((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel={`${MONTHS[viewM - 1]} ${viewY}. Cambiar año`}
                    style={styles.monthTitle}
                  >
                    <AppText variant="h3" style={{ textAlign: 'center', textTransform: 'capitalize' }}>
                      {`${MONTHS[viewM - 1]} ${viewY}`}
                    </AppText>
                  </Pressable>

                  <Pressable
                    onPress={() => goMonth(1)}
                    disabled={!canNext}
                    accessibilityRole="button"
                    accessibilityLabel="Mes siguiente"
                    style={[styles.navBtn, { minWidth: navHit, minHeight: navHit, opacity: canNext ? 1 : 0.35 }]}
                  >
                    <Ionicons name="chevron-forward" size={22} color={colors.textPrimary} />
                  </Pressable>
                </View>

                {pickingYear ? (
                  <View style={[styles.yearWrap, { paddingHorizontal: scaleSpacing(Space[16]) }]}>
                    {years.map((yy) => {
                      const active = yy === viewY;
                      return (
                        <Pressable
                          key={yy}
                          onPress={() => {
                            setViewY(yy);
                            setPickingYear(false);
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={`Año ${yy}`}
                          style={[
                            styles.yearChip,
                            {
                              minHeight: navHit,
                              backgroundColor: active
                                ? isHighContrast
                                  ? colors.textPrimary
                                  : isDark
                                    ? colors.primary
                                    : BrandColors.navy
                                : isDark
                                  ? colors.surface
                                  : BrandColors.beige,
                              borderColor: colors.border,
                              borderWidth: isHighContrast ? 2 : 0,
                            },
                          ]}
                        >
                          <AppText
                            variant="body"
                            style={{
                              fontWeight: '600',
                              color: active
                                ? isHighContrast
                                  ? colors.background
                                  : isDark
                                    ? colors.onPrimary
                                    : BrandColors.white
                                : colors.textPrimary,
                            }}
                          >
                            {String(yy)}
                          </AppText>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <>
                    <View style={[styles.weekRow, { paddingHorizontal: scaleSpacing(Space[8]) }]}>
                      {WEEKDAYS.map((w) => (
                        <View key={w} style={styles.cell}>
                          <AppText variant="caption" tone="secondary" style={{ textAlign: 'center' }}>
                            {w}
                          </AppText>
                        </View>
                      ))}
                    </View>
                    <View style={[styles.grid, { paddingHorizontal: scaleSpacing(Space[8]) }]}>
                      {cells.map((day, idx) => {
                        if (day == null) {
                          return <View key={`e-${idx}`} style={styles.cell} />;
                        }
                        const ymd = toYmd(viewY, viewM, day);
                        const disabled = ymd < bounds.min || ymd > bounds.max;
                        const isSelected = ymd === valueYmd;
                        return (
                          <View key={ymd} style={styles.cell}>
                            <Pressable
                              onPress={() => !disabled && commitDay(day)}
                              disabled={disabled}
                              accessibilityRole="button"
                              accessibilityState={{ selected: isSelected, disabled }}
                              accessibilityLabel={`${day} de ${MONTHS[viewM - 1]} de ${viewY}`}
                              style={[
                                styles.dayBtn,
                                {
                                  minHeight: navHit,
                                  backgroundColor: isSelected
                                    ? isHighContrast
                                      ? colors.textPrimary
                                      : isDark
                                        ? colors.primary
                                        : BrandColors.navy
                                    : 'transparent',
                                  opacity: disabled ? 0.35 : 1,
                                },
                              ]}
                            >
                              <AppText
                                variant="body"
                                style={{
                                  fontSize: dayFont,
                                  lineHeight: dayFont + 4,
                                  fontWeight: isSelected ? '700' : '500',
                                  color: isSelected
                                    ? isHighContrast
                                      ? colors.background
                                      : isDark
                                        ? colors.onPrimary
                                        : BrandColors.white
                                    : colors.textPrimary,
                                }}
                              >
                                {String(day)}
                              </AppText>
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.lg,
    gap: 12,
    width: '100%',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Space[8],
    paddingBottom: Space[16],
  },
  handleRow: {
    alignItems: 'center',
    marginBottom: Space[8],
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.2857%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  yearWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: Space[8],
  },
  yearChip: {
    paddingHorizontal: 16,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
