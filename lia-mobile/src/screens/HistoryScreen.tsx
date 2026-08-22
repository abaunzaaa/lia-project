import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  AppText,
  EditorialText,
  EmptyState,
  Header,
  StatusBadge,
  Toast,
} from '../components';
import { useAuth } from '../context/AuthContext';
import { useReminders } from '../context/ReminderContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors } from '../theme/brand';
import { Radius, Space } from '../theme/tokens';
import { formatDate } from '../utils/helpers';
import {
  addLocalDays,
  formatTimeForDisplay,
  getDeviceTimeZone,
  getLocalDateRange,
  getLocalDateString,
} from '../utils/dateTime';
import {
  DoseStatus,
  HistoryEntry,
  HistoryInsightsData,
} from '../types';
import { getHistory } from '../services/historyApi';
import {
  getHistoryInsights,
  HistoryInsightsApiError,
} from '../services/historyInsightsApi';
import { ApiClientError } from '../services/apiClient';

type PeriodDays = 7 | 30;

function statusLabel(status: DoseStatus): string {
  switch (status) {
    case 'taken':
      return 'Tomada';
    case 'skipped':
      return 'Omitida';
    case 'missed':
      return 'Sin registrar';
    case 'pending':
      return 'Pendiente';
    default:
      return status;
  }
}

function dateSectionTitle(ymd: string): string {
  const today = getLocalDateString();
  const yesterday = addLocalDays(today, -1);
  if (ymd === today) return 'Hoy';
  if (ymd === yesterday) return 'Ayer';
  return formatDate(ymd);
}

function buildDemoInsights(entries: HistoryEntry[], from: string, to: string): HistoryInsightsData {
  const due = entries.filter((e) => e.status !== 'pending');
  const taken = due.filter((e) => e.status === 'taken').length;
  const skipped = due.filter((e) => e.status === 'skipped').length;
  const missed = due.filter((e) => e.status === 'missed').length;
  const totalDue = taken + skipped + missed;
  const adherencePercentage =
    totalDue > 0 ? Math.round((taken / totalDue) * 100) : null;

  const days: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    days.push(cursor);
    cursor = addLocalDays(cursor, 1);
  }

  const daily = days.map((date) => {
    const dayEntries = due.filter((e) => e.date === date);
    const t = dayEntries.filter((e) => e.status === 'taken').length;
    const s = dayEntries.filter((e) => e.status === 'skipped').length;
    const m = dayEntries.filter((e) => e.status === 'missed').length;
    const td = t + s + m;
    return {
      date,
      totalDue: td,
      taken: t,
      skipped: s,
      missed: m,
      adherencePercentage: td > 0 ? Math.round((t / td) * 100) : null,
    };
  });

  return {
    range: { from, to, timezone: getDeviceTimeZone() },
    summary: { totalDue, taken, skipped, missed, adherencePercentage },
    daily,
    byMedication: [],
    byTimeOfDay: [],
    insights:
      totalDue > 0
        ? ['Este es un resumen de ejemplo del modo demo.']
        : [],
  };
}

export default function HistoryScreen() {
  const { isDemo } = useAuth();
  const { history: contextHistory } = useReminders();

  const { scaleFont, scaleSpacing, minTouch, isSeniorMode, fontScale } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const { horizontalPadding, contentMaxWidth, isSmallPhone, compact } = useResponsive();

  const [period, setPeriod] = useState<PeriodDays>(7);
  const [insights, setInsights] = useState<HistoryInsightsData | null>(null);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'error' as const });

  const requestGen = useRef(0);
  const periodRef = useRef(period);
  periodRef.current = period;

  const stackMetrics =
    isSmallPhone || isSeniorMode || fontScale >= 1.2 || compact;

  const load = useCallback(
    async (days: PeriodDays, options?: { silent?: boolean }) => {
      const gen = ++requestGen.current;

      if (!options?.silent) {
        setInsightsLoading(true);
        setHistoryLoading(true);
      }
      setInsightsError(null);

      const { from, to } = getLocalDateRange(days);
      const timezone = getDeviceTimeZone();

      if (isDemo) {
        const demoEntries = contextHistory;
        if (gen !== requestGen.current) return;
        setEntries(demoEntries);
        setInsights(buildDemoInsights(demoEntries, from, to));
        setInsightsLoading(false);
        setHistoryLoading(false);
        return;
      }

      const insightsPromise = getHistoryInsights({ from, to, timezone })
        .then((data) => {
          if (gen !== requestGen.current) return;
          setInsights(data);
          setInsightsError(null);
        })
        .catch((e) => {
          if (gen !== requestGen.current) return;
          const message =
            e instanceof HistoryInsightsApiError || e instanceof ApiClientError
              ? e.status === undefined
                ? 'No pudimos actualizar tu historial. Revisa tu conexión e inténtalo nuevamente.'
                : 'No pudimos cargar el resumen en este momento.'
              : 'No pudimos cargar el resumen en este momento.';
          setInsightsError(message);
          if (!options?.silent) {
            setToast({ visible: true, message, type: 'error' });
          }
        })
        .finally(() => {
          if (gen === requestGen.current) setInsightsLoading(false);
        });

      const historyPromise = getHistory(from, to, timezone)
        .then((data) => {
          if (gen !== requestGen.current) return;
          setEntries(data);
        })
        .catch(() => {
          if (gen !== requestGen.current) return;
          if (!options?.silent) {
            setToast({
              visible: true,
              message:
                'No pudimos actualizar tu historial. Revisa tu conexión e inténtalo nuevamente.',
              type: 'error',
            });
          }
        })
        .finally(() => {
          if (gen === requestGen.current) setHistoryLoading(false);
        });

      await Promise.all([insightsPromise, historyPromise]);
    },
    [isDemo, contextHistory]
  );

  useFocusEffect(
    useCallback(() => {
      void load(periodRef.current, { silent: true });
    }, [load])
  );

  const onSelectPeriod = (days: PeriodDays) => {
    if (days === period) return;
    setPeriod(days);
    void load(days);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load(period);
    setRefreshing(false);
  };

  const grouped = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();
    for (const entry of entries) {
      if (entry.status === 'pending') continue;
      const list = map.get(entry.date) || [];
      list.push(entry);
      map.set(entry.date, list);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  const summary = insights?.summary;
  const percentage = summary?.adherencePercentage ?? null;
  const hasDue = (summary?.totalDue ?? 0) > 0;
  const showInitialLoading =
    (insightsLoading || historyLoading) && !refreshing && !insights && entries.length === 0;

  const surface = isHighContrast
    ? colors.surface
    : isDark
      ? colors.surfaceElevated
      : BrandColors.white;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Historial" subtitle="Un vistazo a tus tomas recientes" editorial />

      {showInitialLoading ? (
        <View style={styles.loadingWrap} accessibilityLabel="Preparando tu historial">
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText variant="body" tone="secondary" style={{ marginTop: scaleSpacing(Space[16]) }}>
            Preparando tu historial…
          </AppText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingHorizontal: horizontalPadding,
              maxWidth: contentMaxWidth,
              alignSelf: 'center',
              width: '100%',
              paddingBottom: scaleSpacing(Space[40]),
            },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/* Period selector */}
          <View
            style={[
              styles.periodRow,
              {
                gap: scaleSpacing(Space[8]),
                marginBottom: scaleSpacing(Space[20]),
              },
            ]}
          >
            {([7, 30] as PeriodDays[]).map((days) => {
              const selected = period === days;
              return (
                <Pressable
                  key={days}
                  onPress={() => onSelectPeriod(days)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={days === 7 ? 'Últimos 7 días' : 'Últimos 30 días'}
                  style={({ pressed }) => [
                    styles.periodChip,
                    {
                      minHeight: minTouch,
                      flex: 1,
                      backgroundColor: selected
                        ? isHighContrast
                          ? colors.textPrimary
                          : isDark
                            ? colors.primary
                            : BrandColors.navy
                        : surface,
                      borderColor: colors.border,
                      borderWidth: isHighContrast ? 2 : selected ? 0 : 1,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <AppText
                    variant="label"
                    style={{
                      color: selected
                        ? isHighContrast
                          ? colors.background
                          : isDark
                            ? colors.onPrimary
                            : BrandColors.white
                        : colors.textPrimary,
                      textAlign: 'center',
                    }}
                  >
                    {days === 7 ? '7 días' : '30 días'}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          {insightsError && !insights ? (
            <AppText
              variant="body"
              tone="secondary"
              style={{ marginBottom: scaleSpacing(Space[16]), flexShrink: 1 }}
            >
              {insightsError}
            </AppText>
          ) : null}

          {/* Summary */}
          {insightsLoading && !insights ? (
            <View style={{ paddingVertical: scaleSpacing(Space[24]), alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : insights && !hasDue ? (
            <EmptyState
              icon="stats-chart-outline"
              title="Aún no hay tomas para analizar"
              description="Cuando registres tus tomas, aquí podrás ver un resumen de tus últimos días."
            />
          ) : insights ? (
            <>
              <View
                style={[
                  styles.sectionSurface,
                  {
                    marginBottom: scaleSpacing(Space[20]),
                    backgroundColor: isHighContrast
                      ? colors.surface
                      : isDark
                        ? colors.surfaceElevated
                        : BrandColors.skyBlue,
                    borderColor: isHighContrast ? colors.border : 'transparent',
                    borderWidth: isHighContrast ? 2 : 0,
                    padding: scaleSpacing(Space[20]),
                    overflow: 'visible',
                  },
                ]}
              >
                {!isHighContrast ? (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.halo,
                      {
                        backgroundColor: isDark ? BrandColors.navy : BrandColors.white,
                        opacity: isDark ? 0.35 : 0.5,
                      },
                    ]}
                  />
                ) : null}

                <AppText
                  variant="overline"
                  style={{
                    color: isHighContrast ? colors.textSecondary : isDark ? colors.textPrimary : BrandColors.navy,
                    marginBottom: scaleSpacing(Space[8]),
                  }}
                >
                  Resumen
                </AppText>
                <AppText
                  variant="caption"
                  tone="secondary"
                  style={{
                    color: isHighContrast ? colors.textSecondary : isDark ? colors.textSecondary : BrandColors.navy,
                    marginBottom: scaleSpacing(Space[12]),
                  }}
                >
                  {period === 7 ? 'Últimos 7 días' : 'Últimos 30 días'}
                </AppText>

                {percentage === null ? (
                  <>
                    <EditorialText
                      variant="headline"
                      style={{
                        fontSize: scaleFont(compact ? 36 : 42),
                        lineHeight: scaleFont(compact ? 42 : 48),
                      }}
                    >
                      —
                    </EditorialText>
                    <AppText
                      variant="body"
                      tone="secondary"
                      style={{ marginTop: scaleSpacing(Space[8]), flexShrink: 1 }}
                    >
                      Aún no hay suficientes tomas en este período.
                    </AppText>
                  </>
                ) : (
                  <>
                    <EditorialText
                      variant="headline"
                      style={{
                        fontSize: scaleFont(compact ? 40 : 48),
                        lineHeight: scaleFont(compact ? 46 : 54),
                      }}
                    >
                      {`${percentage}%`}
                    </EditorialText>
                    <AppText
                      variant="body"
                      tone="secondary"
                      style={{ marginTop: scaleSpacing(Space[4]), flexShrink: 1 }}
                    >
                      de tomas registradas
                    </AppText>
                  </>
                )}

                {summary && summary.totalDue > 0 ? (
                  <AppText
                    variant="caption"
                    tone="muted"
                    style={{ marginTop: scaleSpacing(Space[12]), flexShrink: 1 }}
                  >
                    {`${summary.totalDue} ${
                      summary.totalDue === 1 ? 'toma programada' : 'tomas programadas'
                    } hasta ahora`}
                  </AppText>
                ) : null}
              </View>

              {/* Counters */}
              {summary ? (
                <View
                  style={[
                    styles.metricsRow,
                    stackMetrics && styles.metricsStack,
                    {
                      gap: scaleSpacing(Space[8]),
                      marginBottom: scaleSpacing(Space[24]),
                    },
                  ]}
                >
                  {[
                    {
                      label: 'Tomadas',
                      value: summary.taken,
                      icon: 'checkmark-circle-outline' as const,
                      accent: isDark ? colors.primary : BrandColors.teal,
                    },
                    {
                      label: 'Omitidas',
                      value: summary.skipped,
                      icon: 'remove-circle-outline' as const,
                      accent: isDark ? colors.textPrimary : BrandColors.navy,
                    },
                    {
                      label: 'Sin registrar',
                      value: summary.missed,
                      icon: 'ellipse-outline' as const,
                      accent: isDark ? colors.textPrimary : BrandColors.navy,
                    },
                  ].map((m) => (
                    <View
                      key={m.label}
                      style={[
                        styles.metricChip,
                        stackMetrics && styles.metricChipStack,
                        {
                          backgroundColor: surface,
                          borderColor: colors.border,
                          borderWidth: isHighContrast ? 2 : 1,
                          paddingVertical: scaleSpacing(Space[12]),
                          paddingHorizontal: scaleSpacing(Space[8]),
                          minHeight: minTouch,
                        },
                      ]}
                      accessibilityLabel={`${m.value} ${m.label.toLowerCase()}`}
                    >
                      <Ionicons
                        name={m.icon}
                        size={scaleFont(18)}
                        color={isHighContrast ? colors.textPrimary : m.accent}
                      />
                      <AppText variant="h3" style={{ textAlign: 'center', marginTop: 4 }}>
                        {m.value}
                      </AppText>
                      <AppText
                        variant="caption"
                        tone="secondary"
                        style={{ textAlign: 'center', flexShrink: 1 }}
                      >
                        {m.label}
                      </AppText>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Insights */}
              {insights.insights.length > 0 ? (
                <View
                  style={[
                    styles.sectionSurface,
                    {
                      marginBottom: scaleSpacing(Space[24]),
                      backgroundColor: surface,
                      borderColor: colors.border,
                      borderWidth: isHighContrast ? 2 : StyleSheet.hairlineWidth,
                      padding: scaleSpacing(Space[16]),
                    },
                  ]}
                >
                  <AppText variant="label" style={{ marginBottom: scaleSpacing(Space[12]) }}>
                    Lo que vemos en tus registros
                  </AppText>
                  <View style={{ gap: scaleSpacing(Space[12]) }}>
                    {insights.insights.map((text, idx) => (
                      <View key={`${idx}-${text.slice(0, 20)}`} style={styles.insightRow}>
                        <Ionicons
                          name="sparkles-outline"
                          size={scaleFont(18)}
                          color={isHighContrast ? colors.textPrimary : isDark ? colors.primary : BrandColors.teal}
                          style={{ marginTop: 2 }}
                        />
                        <AppText variant="body" style={{ flex: 1, flexShrink: 1, minWidth: 0 }}>
                          {text}
                        </AppText>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* By medication */}
              {insights.byMedication.length > 0 ? (
                <View
                  style={[
                    styles.sectionSurface,
                    {
                      marginBottom: scaleSpacing(Space[24]),
                      backgroundColor: surface,
                      borderColor: colors.border,
                      borderWidth: isHighContrast ? 2 : StyleSheet.hairlineWidth,
                      padding: scaleSpacing(Space[16]),
                    },
                  ]}
                >
                  <AppText variant="label" style={{ marginBottom: scaleSpacing(Space[12]) }}>
                    Por medicamento
                  </AppText>
                  <View style={{ gap: scaleSpacing(Space[16]) }}>
                    {insights.byMedication.map((med) => {
                      const pct = med.adherencePercentage;
                      const barPct = pct ?? 0;
                      return (
                        <View key={med.medicationId} style={{ width: '100%' }}>
                          <View style={styles.medHeader}>
                            <AppText
                              variant="body"
                              style={{ fontWeight: '600', flex: 1, flexShrink: 1, minWidth: 0 }}
                            >
                              {med.name}
                            </AppText>
                            <AppText variant="caption" tone="secondary">
                              {pct === null ? '—' : `${pct}%`}
                            </AppText>
                          </View>
                          <AppText
                            variant="caption"
                            tone="secondary"
                            style={{ marginTop: 2, flexShrink: 1 }}
                          >
                            {med.totalDue === 0
                              ? 'Sin tomas vencidas'
                              : `${med.taken} de ${med.totalDue} tomadas`}
                          </AppText>
                          {med.totalDue > 0 ? (
                            <View
                              style={[
                                styles.progressTrack,
                                {
                                  backgroundColor: isHighContrast
                                    ? colors.border
                                    : isDark
                                      ? colors.accentSoft
                                      : BrandColors.skyBlue,
                                  marginTop: scaleSpacing(Space[8]),
                                },
                              ]}
                            >
                              <View
                                style={[
                                  styles.progressFill,
                                  {
                                    width: `${Math.min(100, Math.max(0, barPct))}%`,
                                    backgroundColor: isHighContrast
                                      ? colors.textPrimary
                                      : isDark
                                        ? colors.primary
                                        : BrandColors.teal,
                                  },
                                ]}
                              />
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </>
          ) : null}

          {/* Chronological list */}
          <View
            style={[
              styles.sectionSurface,
              {
                marginBottom: scaleSpacing(Space[8]),
                marginTop: scaleSpacing(Space[8]),
                backgroundColor: surface,
                borderColor: colors.border,
                borderWidth: isHighContrast ? 2 : StyleSheet.hairlineWidth,
                padding: scaleSpacing(Space[16]),
              },
            ]}
          >
          <AppText
            variant="label"
            style={{
              marginBottom: scaleSpacing(Space[12]),
            }}
          >
            Tus tomas
          </AppText>

          {historyLoading && entries.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
          ) : grouped.length === 0 ? (
            <EmptyState
              icon="time-outline"
              title="Aún no hay historial"
              description="Cuando marques tomas como tomadas u omitidas, aparecerán aquí con calma."
            />
          ) : (
            grouped.map(([date, dayEntries]) => (
              <View key={date} style={{ marginBottom: scaleSpacing(Space[20]) }}>
                <AppText
                  variant="overline"
                  style={{
                    marginBottom: scaleSpacing(Space[12]),
                    color: isHighContrast ? colors.textSecondary : isDark ? colors.primary : BrandColors.teal,
                  }}
                >
                  {dateSectionTitle(date)}
                </AppText>
                {dayEntries.map((entry, index) => (
                  <View key={entry.id}>
                    <View
                      style={[
                        styles.historyItem,
                        { paddingVertical: scaleSpacing(Space[12]) },
                      ]}
                      accessibilityLabel={`${entry.medicationName}, ${statusLabel(entry.status)}, ${formatTimeForDisplay(entry.time)}`}
                    >
                      <View style={styles.historyInfo}>
                        <AppText
                          variant="h3"
                          style={{
                            color: isHighContrast ? colors.textPrimary : isDark ? colors.textPrimary : BrandColors.navy,
                            marginBottom: 2,
                          }}
                        >
                          {formatTimeForDisplay(entry.time)}
                        </AppText>
                        <AppText variant="body" style={{ fontWeight: '600', flexShrink: 1 }}>
                          {entry.medicationName}
                        </AppText>
                        {entry.dose ? (
                          <AppText variant="caption" tone="secondary" style={{ marginTop: 2 }}>
                            {entry.dose}
                          </AppText>
                        ) : null}
                      </View>
                      <StatusBadge status={entry.status} />
                    </View>
                    {index < dayEntries.length - 1 ? (
                      <View
                        style={{
                          height: StyleSheet.hairlineWidth,
                          backgroundColor: colors.border,
                        }}
                      />
                    ) : null}
                  </View>
                ))}
              </View>
            ))
          )}
          </View>
        </ScrollView>
      )}

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1 },
  sectionSurface: {
    width: '100%',
    borderRadius: Radius.xl,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  periodRow: {
    flexDirection: 'row',
    width: '100%',
  },
  periodChip: {
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  halo: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    top: -36,
    right: -28,
  },
  metricsRow: {
    flexDirection: 'row',
    width: '100%',
  },
  metricsStack: {
    flexDirection: 'column',
  },
  metricChip: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    borderRadius: Radius.lg,
  },
  metricChipStack: {
    flex: undefined,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    width: '100%',
  },
  medHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyInfo: {
    flex: 1,
    minWidth: 0,
  },
});
