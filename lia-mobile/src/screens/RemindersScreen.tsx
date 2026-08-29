import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Header, ReminderCard, EmptyState, AppText, AppModal, Toast } from '../components';
import { useReminders } from '../context/ReminderContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors } from '../theme/brand';
import { Radius, Space, FontWeight } from '../theme/tokens';
import { Reminder } from '../types';
import { getLocalDateString, getLocalWeekDates } from '../utils/dateTime';
import { ApiClientError } from '../services/apiClient';
import { speakText } from '../services/speechService';
import { SPEECH_SKIPPED_OK, SPEECH_TAKEN_OK } from '../utils/speechPhrases';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const TICK_MS = 45_000;

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

  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [refreshing, setRefreshing] = useState(false);
  const [skipTarget, setSkipTarget] = useState<Reminder | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error';
  }>({ visible: false, message: '', type: 'success' });

  const weekDates = useMemo(() => getLocalWeekDates(0, 7), []);
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Recordatorios" subtitle="Lo que aún necesita tu atención" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.calendar}
        contentContainerStyle={[
          styles.calendarContent,
          { paddingHorizontal: horizontalPadding, gap: scaleSpacing(Space[8]) },
        ]}
      >
        {weekDates.map((date) => {
          const d = new Date(date + 'T12:00:00');
          const isSelected = date === selectedDate;
          const isToday = date === today;
          return (
            <Pressable
              key={date}
              onPress={() => onSelectDate(date)}
              accessibilityRole="button"
              accessibilityLabel={`${DAYS[d.getDay()]} ${d.getDate()}${isToday ? ', hoy' : ''}`}
              accessibilityState={{ selected: isSelected }}
              style={[
                styles.dayChip,
                {
                  minWidth: isSmallPhone ? 48 : 56,
                  minHeight: Math.max(minTouch + 8, 72),
                  backgroundColor: isSelected
                    ? isHighContrast
                      ? colors.textPrimary
                      : isDark
                        ? colors.primary
                        : BrandColors.navy
                    : isDark
                      ? colors.surface
                      : BrandColors.white,
                  borderWidth: isHighContrast ? 1 : isSelected ? 0 : isToday ? 2 : 1,
                  borderColor: isHighContrast
                    ? colors.border
                    : isToday && !isSelected
                      ? isDark
                        ? colors.primary
                        : BrandColors.teal
                      : BrandColors.cardBorder,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: scaleFont(12),
                  fontWeight: FontWeight.medium,
                  color: isSelected
                    ? isHighContrast
                      ? colors.onPrimary
                      : isDark
                        ? colors.onPrimary
                        : BrandColors.white
                    : colors.textSecondary,
                }}
              >
                {DAYS[d.getDay()]}
              </Text>
              <Text
                style={{
                  fontSize: scaleFont(18),
                  fontWeight: FontWeight.semiBold,
                  marginTop: 4,
                  color: isSelected
                    ? isHighContrast
                      ? colors.onPrimary
                      : isDark
                        ? colors.onPrimary
                        : BrandColors.white
                    : colors.textPrimary,
                }}
              >
                {d.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View
        style={[
          styles.stats,
          {
            paddingHorizontal: horizontalPadding,
            gap: scaleSpacing(Space[12]),
            marginBottom: scaleSpacing(Space[12]),
            flexDirection: isSeniorMode ? 'column' : 'row',
          },
        ]}
      >
        <View
          style={[
            styles.statCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: isHighContrast ? 2 : 1,
            },
          ]}
        >
          <AppText variant="h2" style={{ color: isHighContrast ? colors.textPrimary : isDark ? colors.primary : BrandColors.teal }}>
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
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: isHighContrast ? 2 : 1,
            },
          ]}
        >
          <AppText
            variant="h2"
            style={{ color: isHighContrast ? colors.textPrimary : isDark ? colors.textPrimary : BrandColors.navy }}
          >
            {missedCount}
          </AppText>
          <AppText variant="caption" tone="secondary">
            Sin registrar
          </AppText>
        </View>
      </View>

      {remindersLoading && !refreshing ? (
        <View style={styles.loadingWrap} accessibilityLabel="Cargando recordatorios">
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText variant="body" tone="secondary" style={{ marginTop: scaleSpacing(Space[16]) }}>
            Cargando tus recordatorios…
          </AppText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.list,
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
          {activeReminders.length === 0 ? (
            <EmptyState
              icon={allResolvedForDay ? 'checkmark-circle-outline' : 'notifications-outline'}
              title={
                allResolvedForDay
                  ? 'Ya estás al día con tus recordatorios'
                  : 'Sin tomas pendientes para este día'
              }
              description={
                allResolvedForDay
                  ? 'Las tomas registradas las puedes ver con calma en Historial.'
                  : 'Cuando tengas medicamentos con horario, LIA los mostrará aquí.'
              }
            />
          ) : (
            activeReminders.map((reminder) => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                nowMs={nowMs}
                onMarkTaken={() => handleTaken(reminder)}
                onMarkSkipped={() => setSkipTarget(reminder)}
                actionLoading={actingReminderId === reminder.id}
              />
            ))
          )}
        </ScrollView>
      )}

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
  calendar: { maxHeight: 100, marginBottom: Space[8], flexGrow: 0 },
  calendarContent: { alignItems: 'center' },
  dayChip: {
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  stats: { flexDirection: 'row' },
  statCard: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Space[16],
    alignItems: 'center',
    minWidth: 0,
  },
  list: { flexGrow: 1 },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
