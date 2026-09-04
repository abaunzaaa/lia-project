import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText, HistoryDeleteModals, HistoryDoseCard } from '../components';
import { useAuth } from '../context/AuthContext';
import { useReminders } from '../context/ReminderContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { Space } from '../theme/tokens';
import { getDeviceTimeZone, getLocalDateString } from '../utils/dateTime';
import { HistoryImages } from '../utils/historyAssets';
import {
  addMonths,
  dayDotColor,
  endOfMonth,
  formatDayMonth,
  formatMonthYear,
  HistoryPalette,
  isVisibleHistoryStatus,
  startOfMonth,
  visibleMonthGrid,
  WEEKDAY_A11Y,
  WEEKDAY_LETTERS,
} from '../utils/historyUi';
import { HistoryEntry, HistoryStackParamList } from '../types';
import { getHistory } from '../services/historyApi';

type Props = {
  navigation: NativeStackNavigationProp<HistoryStackParamList, 'HistoryCalendar'>;
};

export default function HistoryCalendarScreen({ navigation }: Props) {
  const { isDemo } = useAuth();
  const { history: contextHistory, hideHistoryEntry } = useReminders();
  const insets = useSafeAreaInsets();
  const { scaleFont, scaleSpacing, minTouch } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const { horizontalPadding, contentMaxWidth, width, isSmallPhone } = useResponsive();
  const lightChrome = !isDark && !isHighContrast;

  const today = getLocalDateString();
  const [monthCursor, setMonthCursor] = useState(startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmEntry, setConfirmEntry] = useState<HistoryEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error';
  }>({ visible: false, message: '', type: 'error' });

  const requestGen = useRef(0);
  const pageBg = lightChrome ? HistoryPalette.white : colors.background;
  const ink = lightChrome ? HistoryPalette.navyDark : colors.textPrimary;
  const muted = lightChrome ? HistoryPalette.muted : colors.textSecondary;
  const grid = useMemo(() => visibleMonthGrid(monthCursor), [monthCursor]);
  const innerWidth = Math.max(280, width - horizontalPadding * 2 - 32);
  const cellSize = Math.max(44, Math.min(minTouch, Math.floor(innerWidth / 7)));

  const load = useCallback(
    async (month: string, options?: { silent?: boolean }) => {
      const gen = ++requestGen.current;
      if (!options?.silent) setLoading(true);
      const from = startOfMonth(month);
      const to = endOfMonth(month);

      if (isDemo) {
        if (gen !== requestGen.current) return;
        setEntries(contextHistory.filter((item) => item.date >= from && item.date <= to));
        setLoading(false);
        return;
      }

      try {
        const data = await getHistory(from, to, getDeviceTimeZone());
        if (gen !== requestGen.current) return;
        setEntries(data);
      } catch {
        if (gen !== requestGen.current) return;
        if (!options?.silent) {
          setToast({
            visible: true,
            message: 'No pudimos cargar el calendario. Inténtalo nuevamente.',
            type: 'error',
          });
        }
      } finally {
        if (gen === requestGen.current) setLoading(false);
      }
    },
    [isDemo, contextHistory]
  );

  useFocusEffect(
    useCallback(() => {
      void load(monthCursor, { silent: true });
    }, [load, monthCursor])
  );

  const byDate = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.date) ?? [];
      list.push(entry);
      map.set(entry.date, list);
    }
    return map;
  }, [entries]);

  const selectedEntries = useMemo(
    () =>
      (byDate.get(selectedDate) ?? [])
        .filter((item) => isVisibleHistoryStatus(item.status))
        .slice()
        .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor)),
    [byDate, selectedDate]
  );

  const goMonth = (delta: number) => {
    const next = addMonths(monthCursor, delta);
    setMonthCursor(next);
    const from = startOfMonth(next);
    const to = endOfMonth(next);
    if (selectedDate < from || selectedDate > to) {
      setSelectedDate(next === startOfMonth(today) ? today : from);
    }
    void load(next);
  };

  const onConfirmDelete = async () => {
    const entry = confirmEntry;
    if (!entry || deleting) return;
    setDeleting(true);
    try {
      await hideHistoryEntry(entry);
      setConfirmEntry(null);
      setEntries((prev) => prev.filter((item) => item.id !== entry.id));
      setToast({
        visible: true,
        message: 'Registro eliminado del historial.',
        type: 'success',
      });
      void load(monthCursor, { silent: true });
    } catch {
      setConfirmEntry(null);
      setToast({
        visible: true,
        message: 'No pudimos eliminar el registro. Inténtalo nuevamente.',
        type: 'error',
      });
    } finally {
      setDeleting(false);
    }
  };

  const heroSize = isSmallPhone ? 72 : 88;

  return (
    <View style={[styles.container, { backgroundColor: pageBg }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + scaleSpacing(Space[8]),
          paddingHorizontal: horizontalPadding,
          paddingBottom: scaleSpacing(Space[40]),
          maxWidth: contentMaxWidth,
          alignSelf: 'center',
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load(monthCursor);
              setRefreshing(false);
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={({ pressed }) => [
              styles.iconHit,
              { minWidth: minTouch, minHeight: minTouch, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Ionicons name="chevron-back" size={26} color={ink} />
          </Pressable>
          <View style={styles.headerCopy}>
            <AppText
              variant="h1"
              accessibilityRole="header"
              style={{
                color: ink,
                fontSize: scaleFont(26),
                lineHeight: scaleFont(32),
                fontWeight: '600',
                flexShrink: 1,
              }}
            >
              Calendario
            </AppText>
            <AppText variant="body" style={{ color: muted, marginTop: 4, flexShrink: 1 }}>
              Consulta tus tomas por día.
            </AppText>
          </View>
          <Image
            source={HistoryImages.calendarHero}
            style={{ width: heroSize, height: heroSize }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            accessible
            accessibilityLabel="Ilustración de calendario y medicamentos"
          />
        </View>

        <View
          style={[
            styles.monthCard,
            {
              backgroundColor: lightChrome ? HistoryPalette.white : colors.surface,
              borderColor: isHighContrast ? colors.border : 'transparent',
              borderWidth: isHighContrast ? 2 : 0,
              padding: scaleSpacing(Space[16]),
              marginTop: scaleSpacing(Space[16]),
              shadowOpacity: lightChrome ? 0.06 : 0,
              elevation: lightChrome ? 2 : 0,
            },
          ]}
        >
          <View style={styles.monthRow}>
            <Pressable
              onPress={() => goMonth(-1)}
              accessibilityRole="button"
              accessibilityLabel="Mes anterior"
              style={({ pressed }) => [
                styles.iconHit,
                { minWidth: minTouch, minHeight: minTouch, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Ionicons name="chevron-back" size={22} color={ink} />
            </Pressable>
            <AppText
              variant="h3"
              style={{
                flex: 1,
                textAlign: 'center',
                color: ink,
                fontWeight: '600',
                flexShrink: 1,
              }}
            >
              {formatMonthYear(monthCursor)}
            </AppText>
            <Pressable
              onPress={() => goMonth(1)}
              accessibilityRole="button"
              accessibilityLabel="Mes siguiente"
              style={({ pressed }) => [
                styles.iconHit,
                { minWidth: minTouch, minHeight: minTouch, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Ionicons name="chevron-forward" size={22} color={ink} />
            </Pressable>
          </View>

          <View style={[styles.weekHead, { marginTop: scaleSpacing(Space[8]) }]}>
            {WEEKDAY_LETTERS.map((letter, index) => (
              <AppText
                key={`wd-${index}`}
                variant="caption"
                style={{
                  width: cellSize,
                  textAlign: 'center',
                  color: ink,
                  fontWeight: '600',
                }}
                accessibilityLabel={WEEKDAY_A11Y[index]}
              >
                {letter}
              </AppText>
            ))}
          </View>

          {loading && entries.length === 0 ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.grid}>
              {grid.map((cell) => {
                const dayEntries = byDate.get(cell.ymd) ?? [];
                const dot = dayDotColor(dayEntries);
                const selected = cell.ymd === selectedDate;
                const dayNum = Number(cell.ymd.slice(8, 10));
                const todayUnselected = cell.isToday && !selected;
                return (
                  <Pressable
                    key={cell.ymd}
                    onPress={() => {
                      if (cell.inMonth) setSelectedDate(cell.ymd);
                    }}
                    disabled={!cell.inMonth}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatDayMonth(cell.ymd)}${selected ? ', seleccionado' : ''}${cell.isToday ? ', hoy' : ''}`}
                    accessibilityState={{ selected, disabled: !cell.inMonth }}
                    style={({ pressed }) => [
                      styles.cell,
                      {
                        width: cellSize,
                        minHeight: Math.max(cellSize, minTouch),
                        opacity: pressed ? 0.85 : cell.inMonth ? 1 : 0.38,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.dayCircle,
                        {
                          minWidth: 36,
                          minHeight: 36,
                          backgroundColor: selected
                            ? lightChrome
                              ? HistoryPalette.navy
                              : colors.primary
                            : todayUnselected
                              ? lightChrome
                                ? HistoryPalette.pastel
                                : colors.surfaceElevated
                              : 'transparent',
                          borderWidth: todayUnselected ? 1.5 : 0,
                          borderColor: todayUnselected
                            ? lightChrome
                              ? HistoryPalette.navy
                              : colors.primary
                            : 'transparent',
                        },
                      ]}
                    >
                      <AppText
                        variant="body"
                        style={{
                          color: selected
                            ? HistoryPalette.white
                            : cell.isToday
                              ? lightChrome
                                ? HistoryPalette.navy
                                : colors.primary
                              : ink,
                          fontWeight: selected || cell.isToday ? '700' : '500',
                        }}
                      >
                        {String(dayNum)}
                      </AppText>
                    </View>
                    <View style={styles.dotSlot}>
                      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View
            style={[
              styles.legend,
              { marginTop: scaleSpacing(Space[12]) },
            ]}
          >
            <LegendItem color={HistoryPalette.teal} label="Tomado" />
            <LegendItem color={HistoryPalette.coral} label="Omitido" />
            <LegendItem color={HistoryPalette.pendingDot} label="Sin registrar" />
          </View>
        </View>

        <AppText
          variant="h3"
          style={{
            color: ink,
            fontWeight: '600',
            marginTop: scaleSpacing(Space[24]),
            marginBottom: scaleSpacing(Space[12]),
            flexShrink: 1,
          }}
        >
          {selectedEntries.length > 0
            ? `Tomas del ${formatDayMonth(selectedDate)}`
            : 'No hay registros este día'}
        </AppText>

        {selectedEntries.length === 0 ? (
          <AppText variant="body" style={{ color: muted, flexShrink: 1 }}>
            Las tomas registradas para esta fecha aparecerán aquí.
          </AppText>
        ) : (
          selectedEntries.map((item) => (
            <HistoryDoseCard key={item.id} item={item} onDelete={setConfirmEntry} showOpen={false} />
          ))
        )}
      </ScrollView>

      <HistoryDeleteModals
        confirmEntry={confirmEntry}
        toast={toast}
        onConfirm={onConfirmDelete}
        onCancel={() => setConfirmEntry(null)}
        onHideToast={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem} accessible accessibilityLabel={label}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <AppText variant="caption" style={{ flexShrink: 1 }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    paddingTop: 6,
  },
  iconHit: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCard: {
    width: '100%',
    borderRadius: 24,
    shadowColor: '#245C86',
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 2,
  },
  dayCircle: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  dotSlot: {
    minHeight: 10,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
