import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../components';
import { useAuth } from '../context/AuthContext';
import { useReminders } from '../context/ReminderContext';
import { useMedications } from '../context/MedicationContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { Space } from '../theme/tokens';
import { getDeviceTimeZone, getLocalDateString } from '../utils/dateTime';
import { HistoryImages } from '../utils/historyAssets';
import { getMedicationImageSource } from '../config/medicationImages';
import {
  clampPercent,
  currentWeekRange,
  dayAdherencePercent,
  HistoryPalette,
  isVisibleHistoryStatus,
  weekBarColor,
  weekDates,
  WEEKDAY_A11Y,
  WEEKDAY_LETTERS,
} from '../utils/historyUi';
import {
  HistoryEntry,
  HistoryInsightsDaily,
  HistoryInsightsData,
  HistoryInsightsMedication,
  HistoryStackParamList,
} from '../types';
import { getHistoryInsights } from '../services/historyInsightsApi';

type Props = {
  navigation: NativeStackNavigationProp<HistoryStackParamList, 'HistoryAnalysis'>;
};

const BAR_MAX = 96;
const BAR_MIN = 8;
const BAR_EMPTY = 10;

function emptyDaily(date: string): HistoryInsightsDaily {
  return {
    date,
    totalDue: 0,
    taken: 0,
    skipped: 0,
    missed: 0,
    adherencePercentage: null,
  };
}

function ensureWeekDaily(daily: HistoryInsightsDaily[], from: string): HistoryInsightsDaily[] {
  const map = new Map(daily.map((day) => [day.date, day]));
  return weekDates(from).map((date) => map.get(date) ?? emptyDaily(date));
}

function insightsFromEntries(
  entries: HistoryEntry[],
  from: string,
  to: string
): HistoryInsightsData {
  const visible = entries.filter(
    (item) => isVisibleHistoryStatus(item.status) && item.date >= from && item.date <= to
  );
  const dailyMap = new Map<string, HistoryInsightsDaily>();
  for (const date of weekDates(from)) {
    dailyMap.set(date, emptyDaily(date));
  }
  const medMap = new Map<string, HistoryInsightsMedication>();
  let taken = 0;
  let skipped = 0;
  let missed = 0;

  for (const item of visible) {
    const day = dailyMap.get(item.date);
    if (day) {
      day.totalDue += 1;
      if (item.status === 'taken') day.taken += 1;
      if (item.status === 'skipped') day.skipped += 1;
      if (item.status === 'missed') day.missed += 1;
    }
    if (item.status === 'taken') taken += 1;
    else if (item.status === 'skipped') skipped += 1;
    else missed += 1;

    const current = medMap.get(item.medicationId) ?? {
      medicationId: item.medicationId,
      name: item.medicationName?.trim() || 'Medicamento',
      totalDue: 0,
      taken: 0,
      skipped: 0,
      missed: 0,
      adherencePercentage: null,
    };
    current.totalDue += 1;
    if (item.status === 'taken') current.taken += 1;
    if (item.status === 'skipped') current.skipped += 1;
    if (item.status === 'missed') current.missed += 1;
    medMap.set(item.medicationId, current);
  }

  const finalize = <
    T extends {
      totalDue: number;
      taken: number;
      skipped: number;
      missed: number;
      adherencePercentage: number | null;
    },
  >(
    bucket: T
  ): T => {
    bucket.adherencePercentage = dayAdherencePercent(bucket.taken, bucket.totalDue);
    return bucket;
  };

  const daily = Array.from(dailyMap.values()).map((day) => finalize(day));
  const byMedication = Array.from(medMap.values()).map((med) => finalize(med));
  const totalDue = taken + skipped + missed;

  return {
    range: { from, to, timezone: getDeviceTimeZone() },
    summary: finalize({ totalDue, taken, skipped, missed, adherencePercentage: null }),
    daily,
    byMedication,
    byTimeOfDay: [],
    insights: [],
  };
}

function medicationArt(
  name: string,
  imageUrl?: string | null
): ImageSourcePropType {
  const catalog = getMedicationImageSource(name);
  if (imageUrl && imageUrl.trim().length > 0) return { uri: imageUrl };
  return catalog;
}

export default function HistoryAnalysisScreen({ navigation }: Props) {
  const { isDemo } = useAuth();
  const { history: contextHistory } = useReminders();
  const { medications } = useMedications();
  const insets = useSafeAreaInsets();
  const { scaleFont, scaleSpacing, minTouch } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const { horizontalPadding, contentMaxWidth, isSmallPhone } = useResponsive();
  const lightChrome = !isDark && !isHighContrast;

  const [data, setData] = useState<HistoryInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const requestGen = useRef(0);

  const pageBg = lightChrome ? HistoryPalette.white : colors.background;
  const ink = lightChrome ? HistoryPalette.navyDark : colors.textPrimary;
  const muted = lightChrome ? HistoryPalette.muted : colors.textSecondary;
  const cardBg = lightChrome ? HistoryPalette.pastel : colors.surfaceElevated;
  const week = currentWeekRange();
  const today = getLocalDateString();

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      const gen = ++requestGen.current;
      if (!options?.silent) setLoading(true);
      const { from, to } = currentWeekRange();

      if (isDemo) {
        if (gen !== requestGen.current) return;
        setData(insightsFromEntries(contextHistory, from, to));
        setLoading(false);
        return;
      }

      try {
        const next = await getHistoryInsights({ from, to, timezone: getDeviceTimeZone() });
        if (gen !== requestGen.current) return;
        setData(next);
      } catch {
        if (gen !== requestGen.current) return;
        setData(null);
      } finally {
        if (gen === requestGen.current) setLoading(false);
      }
    },
    [isDemo, contextHistory]
  );

  useFocusEffect(
    useCallback(() => {
      void load({ silent: true });
    }, [load])
  );

  const daily = useMemo(
    () => ensureWeekDaily(data?.daily ?? [], week.from),
    [data?.daily, week.from]
  );
  const summary = data?.summary;
  const programmed = summary?.totalDue ?? 0;
  const taken = summary?.taken ?? 0;
  const overallPct = dayAdherencePercent(taken, programmed);
  const hasProgrammed = programmed > 0;
  const medicationsWithDoses = useMemo(
    () => (data?.byMedication ?? []).filter((med) => med.totalDue > 0),
    [data?.byMedication]
  );

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
              await load();
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
              Análisis de tomas
            </AppText>
            <AppText variant="body" style={{ color: muted, marginTop: 4, flexShrink: 1 }}>
              Conoce cómo avanzan tus tomas.
            </AppText>
          </View>
        </View>

        {loading && !data ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <AppText variant="body" tone="secondary" style={{ marginTop: scaleSpacing(Space[12]) }}>
              Preparando tu análisis…
            </AppText>
          </View>
        ) : !data ? (
          <AppText
            variant="body"
            style={{ color: muted, flexShrink: 1, marginTop: scaleSpacing(Space[20]) }}
          >
            No pudimos cargar el análisis. Inténtalo nuevamente.
          </AppText>
        ) : (
          <>
            <View
              style={[
                styles.chartCard,
                {
                  backgroundColor: cardBg,
                  borderColor: isHighContrast ? colors.border : 'transparent',
                  borderWidth: isHighContrast ? 2 : 0,
                  padding: scaleSpacing(Space[20]),
                  marginTop: scaleSpacing(Space[20]),
                  marginBottom: scaleSpacing(Space[20]),
                  shadowOpacity: lightChrome ? 0.06 : 0,
                  elevation: lightChrome ? 2 : 0,
                },
              ]}
            >
              <View style={styles.chartHead}>
                <AppText
                  variant="body"
                  style={{
                    color: ink,
                    fontWeight: '600',
                    flex: 1,
                    flexShrink: 1,
                    paddingRight: 8,
                  }}
                >
                  Tu constancia esta semana
                </AppText>
                <View style={styles.chartStats} accessible accessibilityRole="text">
                  {hasProgrammed ? (
                    <>
                      <AppText
                        variant="h1"
                        style={{
                          color: ink,
                          fontSize: scaleFont(28),
                          lineHeight: scaleFont(34),
                          fontWeight: '700',
                          textAlign: 'right',
                        }}
                      >
                        {`${overallPct ?? 0} %`}
                      </AppText>
                      <AppText
                        variant="caption"
                        style={{ color: muted, textAlign: 'right', marginTop: 2 }}
                      >
                        {`${taken} de ${programmed} tomas`}
                      </AppText>
                    </>
                  ) : (
                    <AppText
                      variant="body"
                      style={{ color: muted, textAlign: 'right', flexShrink: 1 }}
                    >
                      Sin tomas programadas
                    </AppText>
                  )}
                </View>
              </View>

              <View style={styles.chartBody}>
                <View
                  style={[styles.bars, { height: BAR_MAX + 28 }]}
                  accessibilityRole="summary"
                  accessibilityLabel="Cumplimiento de tomas de lunes a domingo"
                >
                  {daily.map((day, index) => {
                    const programmedDay = day.totalDue;
                    const pct = dayAdherencePercent(day.taken, programmedDay);
                    const todayFlag = day.date === today;
                    const empty = programmedDay <= 0;
                    const barHeight = empty
                      ? BAR_EMPTY
                      : Math.max(BAR_MIN, Math.round(((pct ?? 0) / 100) * BAR_MAX));
                    const label = WEEKDAY_LETTERS[index];
                    const a11yDay = WEEKDAY_A11Y[index];
                    return (
                      <View key={day.date} style={styles.barCol}>
                        <View style={styles.barTrack}>
                          <View
                            style={{
                              width: '100%',
                              height: barHeight,
                              borderRadius: 10,
                              backgroundColor: empty
                                ? lightChrome
                                  ? HistoryPalette.barEmpty
                                  : colors.border
                                : weekBarColor(index, todayFlag),
                            }}
                            accessible
                            accessibilityLabel={
                              empty
                                ? `${a11yDay}: sin tomas programadas`
                                : `${a11yDay}: ${day.taken} de ${programmedDay} tomas, ${pct} por ciento`
                            }
                          />
                        </View>
                        <AppText
                          variant="caption"
                          style={{
                            color: muted,
                            marginTop: 6,
                            fontSize: scaleFont(isSmallPhone ? 11 : 12),
                            fontWeight: todayFlag ? '700' : '600',
                          }}
                        >
                          {label}
                        </AppText>
                      </View>
                    );
                  })}
                </View>

                <View style={[styles.womanWrap, isSmallPhone && styles.womanWrapSmall]}>
                  <Image
                    source={HistoryImages.analysisWoman}
                    style={styles.womanImg}
                    resizeMode="contain"
                    accessibilityIgnoresInvertColors
                    accessible
                    accessibilityLabel="Ilustración de una señora adulta mayor observando una gráfica"
                  />
                </View>
              </View>
            </View>

            <AppText
              variant="h3"
              style={{ color: ink, fontWeight: '600', marginBottom: scaleSpacing(Space[12]) }}
            >
              Resumen
            </AppText>

            <View
              style={[
                styles.statRow,
                { gap: scaleSpacing(Space[8]), marginBottom: scaleSpacing(Space[24]) },
              ]}
            >
              <SummaryCard
                count={summary?.taken ?? 0}
                label="Tomadas"
                image={HistoryImages.taken}
                bg={lightChrome ? HistoryPalette.takenBg : colors.surface}
                fg={lightChrome ? HistoryPalette.takenFg : colors.textPrimary}
                imageLabel="Tomas tomadas"
              />
              <SummaryCard
                count={summary?.skipped ?? 0}
                label="Omitidas"
                image={HistoryImages.omitted}
                bg={lightChrome ? HistoryPalette.skippedBg : colors.surface}
                fg={lightChrome ? HistoryPalette.skippedFg : colors.textPrimary}
                imageLabel="Tomas omitidas"
              />
              <SummaryCard
                count={summary?.missed ?? 0}
                label="Sin registrar"
                image={HistoryImages.pending}
                bg={lightChrome ? HistoryPalette.missedBg : colors.surface}
                fg={lightChrome ? HistoryPalette.missedFg : colors.textPrimary}
                imageLabel="Tomas sin registrar"
              />
            </View>

            <AppText
              variant="h3"
              style={{ color: ink, fontWeight: '600', marginBottom: scaleSpacing(Space[12]) }}
            >
              Por medicamento
            </AppText>

            {medicationsWithDoses.length === 0 ? (
              <AppText
                variant="body"
                style={{ color: muted, flexShrink: 1, marginBottom: scaleSpacing(Space[16]) }}
              >
                Cuando tengas tomas programadas esta semana, verás el detalle por medicamento.
              </AppText>
            ) : (
              medicationsWithDoses.map((med, index) => {
                const pct = dayAdherencePercent(med.taken, med.totalDue) ?? 0;
                const saved = medications.find((item) => item.id === med.medicationId);
                const name = (saved?.name || med.name || 'Medicamento').trim() || 'Medicamento';
                const art = medicationArt(name, saved?.imageUrl);
                const barColor =
                  index % 2 === 0
                    ? lightChrome
                      ? HistoryPalette.navy
                      : colors.primary
                    : HistoryPalette.teal;
                return (
                  <View
                    key={med.medicationId}
                    style={[
                      styles.medCard,
                      {
                        backgroundColor: lightChrome ? HistoryPalette.white : colors.surface,
                        borderColor: isHighContrast ? colors.border : 'transparent',
                        borderWidth: isHighContrast ? 2 : 0,
                        padding: scaleSpacing(Space[16]),
                        marginBottom: scaleSpacing(Space[12]),
                        shadowOpacity: lightChrome ? 0.05 : 0,
                        elevation: lightChrome ? 1 : 0,
                      },
                    ]}
                    accessible
                    accessibilityLabel={`${name}, ${med.taken} de ${med.totalDue} tomas, ${pct} por ciento`}
                  >
                    <View style={styles.medRow}>
                      <View style={styles.medArt}>
                        {art ? (
                          <Image
                            source={art}
                            style={styles.medImg}
                            resizeMode="contain"
                            accessibilityIgnoresInvertColors
                          />
                        ) : (
                          <View
                            style={[
                              styles.medFallback,
                              { backgroundColor: lightChrome ? HistoryPalette.pastel : colors.border },
                            ]}
                            accessibilityLabel="Sin imagen de medicamento"
                          />
                        )}
                      </View>
                      <View style={styles.medCopy}>
                        <View style={styles.medTitleRow}>
                          <AppText
                            variant="body"
                            style={{ color: ink, fontWeight: '600', flex: 1, flexShrink: 1 }}
                            numberOfLines={2}
                          >
                            {name}
                          </AppText>
                          <AppText
                            variant="body"
                            style={{ color: ink, fontWeight: '700', marginLeft: 8 }}
                          >
                            {`${pct} %`}
                          </AppText>
                        </View>
                        <AppText variant="caption" style={{ color: muted, marginTop: 2 }}>
                          {`${med.taken} de ${med.totalDue} tomas`}
                        </AppText>
                        <View
                          style={[
                            styles.medTrack,
                            {
                              backgroundColor: lightChrome ? HistoryPalette.pastel : colors.border,
                              marginTop: 10,
                            },
                          ]}
                        >
                          <View
                            style={{
                              width: `${clampPercent(pct)}%`,
                              height: 10,
                              borderRadius: 10,
                              backgroundColor: barColor,
                            }}
                          />
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SummaryCard({
  count,
  label,
  image,
  bg,
  fg,
  imageLabel,
}: {
  count: number;
  label: string;
  image: ImageSourcePropType;
  bg: string;
  fg: string;
  imageLabel: string;
}) {
  const { scaleFont, scaleSpacing } = useAccessibility();
  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: bg,
          padding: scaleSpacing(Space[12]),
          minHeight: 108,
        },
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${count} ${label}`}
    >
      <AppText
        variant="h1"
        style={{
          color: fg,
          fontWeight: '700',
          fontSize: scaleFont(28),
          lineHeight: scaleFont(34),
        }}
      >
        {String(count)}
      </AppText>
      <AppText
        variant="caption"
        style={{ color: fg, fontWeight: '600', flexShrink: 1, marginTop: 2 }}
      >
        {label}
      </AppText>
      <Image
        source={image}
        style={styles.statImg}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
        accessible
        accessibilityLabel={imageLabel}
      />
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
  chartCard: {
    width: '100%',
    borderRadius: 24,
    shadowColor: '#245C86',
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  chartHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  chartStats: {
    alignItems: 'flex-end',
    maxWidth: '46%',
  },
  chartBody: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  bars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minWidth: 0,
    gap: 4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
  },
  barTrack: {
    flex: 1,
    width: '72%',
    maxWidth: 18,
    justifyContent: 'flex-end',
  },
  womanWrap: {
    width: 112,
    height: 148,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  womanImg: {
    width: '100%',
    height: '100%',
  },
  womanWrapSmall: {
    width: 88,
    height: 120,
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
  },
  statCard: {
    flexGrow: 1,
    flexBasis: 96,
    minWidth: 96,
    borderRadius: 20,
    overflow: 'hidden',
  },
  statImg: {
    width: 44,
    height: 44,
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  medCard: {
    width: '100%',
    borderRadius: 22,
    shadowColor: '#245C86',
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  medArt: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  medImg: {
    width: 56,
    height: 56,
  },
  medFallback: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  medCopy: {
    flex: 1,
    minWidth: 0,
  },
  medTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  medTrack: {
    width: '100%',
    height: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
});
