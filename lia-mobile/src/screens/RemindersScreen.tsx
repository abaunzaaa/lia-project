import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReminderCard, AppText, AppModal, Toast } from '../components';
import DateFieldPicker from '../components/DateFieldPicker';
import { useReminders } from '../context/ReminderContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors, liaCardBorder } from '../theme/brand';
import { Space, FontFamily, FontWeight } from '../theme/tokens';
import { Reminder } from '../types';
import { getLocalDateString, getLocalWeekDates, addLocalDays } from '../utils/dateTime';
import { ApiClientError } from '../services/apiClient';
import { speakText } from '../services/speechService';
import { SPEECH_SKIPPED_OK, SPEECH_TAKEN_OK } from '../utils/speechPhrases';

const WEEKDAY_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTH_ES = [
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
const TICK_MS = 45_000;
const SINTOMAS_IMAGE = require('../assets/images/sintomas.png');

export default function RemindersScreen() {
  const {
    reminders,
    remindersLoading,
    refreshReminders,
    markTaken,
    markSkipped,
    actingReminderId,
  } = useReminders();
  const { scaleFont, scaleSpacing, minTouch, voiceEnabled, isSeniorMode } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const { horizontalPadding, contentMaxWidth, isSmallPhone } = useResponsive();
  const insets = useSafeAreaInsets();
  const lightChrome = !isDark && !isHighContrast;

  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [weekDates, setWeekDates] = useState(() => getLocalWeekDates(0, 7));
  const [refreshing, setRefreshing] = useState(false);
  const [skipTarget, setSkipTarget] = useState<Reminder | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error';
  }>({ visible: false, message: '', type: 'success' });

  const today = getLocalDateString();

  const load = useCallback(
    async (date: string, silent = false) => {
      try {
        await refreshReminders(date);
      } catch (e) {
        if (!silent) {
          const message =
            e instanceof ApiClientError || e instanceof Error
              ? e.message
              : 'No pudimos completar la acción. Inténtalo nuevamente.';
          setToast({ visible: true, message, type: 'error' });
        }
      }
    },
    [refreshReminders]
  );

  useFocusEffect(
    useCallback(() => {
      void load(selectedDate, true);
      setNowMs(Date.now());
      const id = setInterval(() => setNowMs(Date.now()), TICK_MS);
      return () => clearInterval(id);
    }, [selectedDate, load])
  );

  const onSelectDate = (date: string) => {
    setSelectedDate(date);
    void load(date);
  };

  const onPickCalendarDate = (date: string) => {
    setSelectedDate(date);
    setWeekDates(Array.from({ length: 7 }, (_, i) => addLocalDays(date, i - 3)));
    void load(date);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load(selectedDate);
    setRefreshing(false);
  };

  const handleTaken = async (reminder: Reminder) => {
    try {
      await markTaken(reminder);
      setToast({ visible: true, message: 'Toma registrada correctamente.', type: 'success' });
      if (voiceEnabled) {
        void speakText(SPEECH_TAKEN_OK, { id: `taken-${reminder.id}` });
      }
    } catch {
      setToast({
        visible: true,
        message: 'No pudimos registrar esta toma. Inténtalo nuevamente.',
        type: 'error',
      });
    }
  };

  const confirmSkip = async () => {
    if (!skipTarget) return;
    const target = skipTarget;
    setSkipTarget(null);
    try {
      await markSkipped(target);
      setToast({ visible: true, message: 'Omitido registrado correctamente.', type: 'success' });
      if (voiceEnabled) {
        void speakText(SPEECH_SKIPPED_OK, { id: `skipped-${target.id}` });
      }
    } catch {
      setToast({
        visible: true,
        message: 'No pudimos registrar esta toma. Inténtalo nuevamente.',
        type: 'error',
      });
    }
  };

  /** Lista de atención: solo lo que aún requiere acción (no es Historial). */
  const activeReminders = useMemo(
    () =>
      reminders
        .filter((r) => r.status === 'pending' || r.status === 'missed')
        .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)),
    [reminders]
  );

  const pendingCount = activeReminders.filter((r) => r.status === 'pending').length;
  const missedCount = activeReminders.filter((r) => r.status === 'missed').length;
  const allResolvedForDay = reminders.length > 0 && activeReminders.length === 0;

  const selectedDateObj = useMemo(() => new Date(`${selectedDate}T12:00:00`), [selectedDate]);
  const monthLabel = `${MONTH_ES[selectedDateObj.getMonth()][0].toUpperCase()}${MONTH_ES[selectedDateObj.getMonth()].slice(1)} ${selectedDateObj.getFullYear()}`;
  const dayCircle = Math.max(40, Math.min(minTouch, 48));

  return (
    <View style={[styles.container, { backgroundColor: lightChrome ? '#FFFFFF' : colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.list,
          {
            paddingTop: insets.top + scaleSpacing(Space[8]),
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
        <AppText
          variant="h1"
          accessibilityRole="header"
          style={{
            color: lightChrome ? BrandColors.navy : colors.textPrimary,
            fontSize: scaleFont(26),
            lineHeight: scaleFont(32),
            letterSpacing: -0.2,
            fontWeight: '600',
            marginBottom: scaleSpacing(Space[16]),
          }}
        >
          Recordatorios
        </AppText>

        <View
          style={[
            styles.calendarCard,
            {
              backgroundColor: lightChrome ? '#E8ECEF' : colors.surfaceElevated,
              borderColor: isHighContrast ? colors.border : 'transparent',
              borderWidth: isHighContrast ? 2 : 0,
              marginBottom: scaleSpacing(Space[20]),
              paddingVertical: scaleSpacing(Space[20]),
              paddingHorizontal: scaleSpacing(isSmallPhone ? Space[12] : Space[16]),
            },
          ]}
        >
          <View style={[styles.calHeader, { marginBottom: scaleSpacing(Space[16]) }]}>
            <AppText
              variant="h3"
              numberOfLines={1}
              style={{
                flex: 1,
                minWidth: 0,
                color: lightChrome ? BrandColors.navy : colors.textPrimary,
                fontFamily: FontFamily.semiBold,
                fontWeight: FontWeight.semiBold,
                textAlign: 'left',
              }}
            >
              {monthLabel}
            </AppText>
            <DateFieldPicker
              variant="icon"
              label="Fecha"
              valueYmd={selectedDate}
              onChange={onPickCalendarDate}
            />
          </View>
          <View style={styles.weekRow}>
            {weekDates.map((date) => {
              const d = new Date(`${date}T12:00:00`);
              const isSelected = date === selectedDate;
              const isToday = date === today;
              const weekday = WEEKDAY_ES[d.getDay()];
              return (
                <Pressable
                  key={date}
                  onPress={() => onSelectDate(date)}
                  accessibilityRole="button"
                  accessibilityLabel={`${weekday} ${d.getDate()}${isToday ? ', hoy' : ''}`}
                  accessibilityState={{ selected: isSelected }}
                  style={styles.dayCol}
                >
                  <AppText
                    variant="caption"
                    style={{
                      color: isSelected
                        ? lightChrome
                          ? BrandColors.navy
                          : colors.textPrimary
                        : lightChrome
                          ? BrandColors.teal
                          : colors.textSecondary,
                      fontFamily: FontFamily.medium,
                      fontWeight: FontWeight.medium,
                      textAlign: 'center',
                      marginBottom: 8,
                      textTransform: 'capitalize',
                    }}
                  >
                    {weekday}
                  </AppText>
                  <View
                    style={[
                      styles.dayCircle,
                      {
                        width: dayCircle,
                        height: dayCircle,
                        borderRadius: dayCircle / 2,
                        backgroundColor: isSelected
                          ? isHighContrast
                            ? colors.textPrimary
                            : BrandColors.navy
                          : 'transparent',
                        borderWidth: isToday && !isSelected ? 1.5 : 0,
                        borderColor: lightChrome ? BrandColors.teal : colors.primary,
                      },
                    ]}
                  >
                    <AppText
                      variant="body"
                      style={{
                        color: isSelected
                          ? BrandColors.white
                          : lightChrome
                            ? BrandColors.navy
                            : colors.textPrimary,
                        fontFamily: FontFamily.semiBold,
                        fontWeight: FontWeight.semiBold,
                        textAlign: 'center',
                      }}
                    >
                      {String(d.getDate())}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View
          style={[
            styles.stats,
            {
              gap: scaleSpacing(Space[12]),
              marginBottom: scaleSpacing(Space[20]),
              flexDirection: isSeniorMode ? 'column' : 'row',
            },
          ]}
        >
          <View
            style={[
              styles.statCard,
              {
                backgroundColor: lightChrome ? '#EAF3F7' : colors.surface,
                borderColor: isHighContrast ? colors.border : 'transparent',
                borderWidth: isHighContrast ? 2 : 0,
              },
            ]}
          >
            <AppText
              variant="h2"
              style={{
                color: isHighContrast ? colors.textPrimary : isDark ? colors.primary : BrandColors.navy,
              }}
            >
              {pendingCount}
            </AppText>
            <AppText variant="caption" tone="secondary">
              Pendientes
            </AppText>
          </View>
          <View
            style={[
              styles.statCard,
              {
                backgroundColor: lightChrome ? '#EAF3F7' : colors.surface,
                borderColor: isHighContrast ? colors.border : 'transparent',
                borderWidth: isHighContrast ? 2 : 0,
              },
            ]}
          >
            <AppText
              variant="h2"
              style={{
                color: isHighContrast ? colors.textPrimary : isDark ? colors.textPrimary : BrandColors.navy,
              }}
            >
              {missedCount}
            </AppText>
            <AppText variant="caption" tone="secondary">
              Sin registrar
            </AppText>
          </View>
        </View>

        <AppText variant="body" style={styles.sectionTitle}>
          Plan de hoy
        </AppText>

        {remindersLoading && !refreshing ? (
          <View style={styles.loadingInline} accessibilityLabel="Cargando recordatorios">
            <ActivityIndicator size="large" color={colors.primary} />
            <AppText variant="body" tone="secondary" style={{ marginTop: scaleSpacing(Space[16]) }}>
              Cargando tus recordatorios…
            </AppText>
          </View>
        ) : activeReminders.length === 0 ? (
          <View
            accessible
            accessibilityRole="text"
            accessibilityLabel={`${
              allResolvedForDay
                ? 'Ya estás al día con tus recordatorios'
                : 'Sin tomas pendientes para este día'
            }. ${
              allResolvedForDay
                ? 'Las tomas registradas las puedes ver con calma en Historial.'
                : 'Cuando tengas medicamentos con horario, LIA los mostrará aquí.'
            }`}
            style={[
              styles.emptyCard,
              {
                backgroundColor: lightChrome ? BrandColors.white : colors.surface,
                borderColor: liaCardBorder(lightChrome, colors.border),
                borderWidth: isHighContrast ? 2 : 1,
                paddingHorizontal: scaleSpacing(Space[24]),
                paddingVertical: scaleSpacing(Space[24]),
              },
            ]}
          >
            <Image
              source={SINTOMAS_IMAGE}
              style={styles.emptyArt}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <AppText
              variant="h3"
              style={{
                marginTop: scaleSpacing(Space[16]),
                color: lightChrome ? BrandColors.navy : colors.textPrimary,
                fontFamily: FontFamily.semiBold,
                fontWeight: FontWeight.semiBold,
                textAlign: 'center',
              }}
            >
              {allResolvedForDay
                ? 'Ya estás al día con tus recordatorios'
                : 'Sin tomas pendientes para este día'}
            </AppText>
            <AppText
              variant="body"
              style={{
                marginTop: scaleSpacing(Space[8]),
                color: lightChrome ? BrandColors.teal : colors.textSecondary,
                fontFamily: FontFamily.regular,
                fontWeight: FontWeight.regular,
                textAlign: 'center',
              }}
            >
              {allResolvedForDay
                ? 'Las tomas registradas las puedes ver con calma en Historial.'
                : 'Cuando tengas medicamentos con horario, LIA los mostrará aquí.'}
            </AppText>
          </View>
        ) : (
          activeReminders.map((reminder, index) => (
            <ReminderCard
              key={reminder.id}
              reminder={reminder}
              nowMs={nowMs}
              isFirst={index === 0}
              isLast={index === activeReminders.length - 1}
              onMarkTaken={() => handleTaken(reminder)}
              onMarkSkipped={() => setSkipTarget(reminder)}
              actionLoading={actingReminderId === reminder.id}
            />
          ))
        )}
      </ScrollView>

      <AppModal
        visible={!!skipTarget}
        title="¿Quieres omitir esta toma?"
        message={
          skipTarget
            ? `${skipTarget.medicationName} quedará marcada como omitida.`
            : 'Quedará marcada como omitida.'
        }
        confirmText="Omitir"
        onConfirm={confirmSkip}
        onCancel={() => setSkipTarget(null)}
        destructive
      />

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
  calendarCard: {
    width: '100%',
    borderRadius: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 2,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  dayCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: { flexDirection: 'row' },
  sectionTitle: {
    marginTop: 5,
    marginBottom: 12,
    color: '#6F747A',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
    textTransform: 'none',
  },
  statCard: {
    flex: 1,
    borderRadius: 24,
    padding: Space[16],
    alignItems: 'center',
    minWidth: 0,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 1,
  },
  list: { flexGrow: 1 },
  emptyCard: {
    width: '100%',
    alignItems: 'center',
    borderRadius: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 1,
  },
  emptyArt: {
    width: 200,
    height: 200,
  },
  loadingInline: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
});
