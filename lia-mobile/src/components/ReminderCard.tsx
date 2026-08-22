import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Space } from '../theme/tokens';
import { useAccessibility } from '../context/AccessibilityContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors } from '../theme/brand';
import { useTheme } from '../context/ThemeContext';
import { formatTimeForDisplay } from '../utils/dateTime';
import { Reminder } from '../types';
import AppText from './AppText';
import SurfaceCard from './SurfaceCard';
import StatusBadge from './StatusBadge';
import DoseActions from './DoseActions';
import SpeakButton from './SpeakButton';
import { buildReminderSpeech } from '../utils/speechPhrases';

interface ReminderCardProps {
  reminder: Reminder;
  onMarkTaken?: () => void;
  onMarkSkipped?: () => void;
  actionLoading?: boolean;
  /** Tick local para re-evaluar disponibilidad sin polling al backend. */
  nowMs?: number;
}

function scheduledTimeReached(reminder: Reminder, nowMs: number): boolean {
  const scheduled = Date.parse(reminder.scheduledFor);
  if (!Number.isNaN(scheduled)) {
    return nowMs >= scheduled;
  }
  // Fallback: comparar HH:mm del mismo día local
  const [h, m] = (reminder.scheduledTime || '00:00').split(':').map((n) => parseInt(n, 10));
  const d = new Date(nowMs);
  const minsNow = d.getHours() * 60 + d.getMinutes();
  const minsSched = (h || 0) * 60 + (m || 0);
  return minsNow >= minsSched;
}

export default function ReminderCard({
  reminder,
  onMarkTaken,
  onMarkSkipped,
  actionLoading = false,
  nowMs: nowMsProp,
}: ReminderCardProps) {
  const { scaleSpacing, scaleFont, isSeniorMode, fontScale } = useAccessibility();
  const { isSmallPhone } = useResponsive();
  const { isHighContrast } = useTheme();

  const [localNow, setLocalNow] = useState(() => Date.now());
  const nowMs = nowMsProp ?? localNow;

  useEffect(() => {
    if (nowMsProp != null) return;
    const id = setInterval(() => setLocalNow(Date.now()), 45_000);
    return () => clearInterval(id);
  }, [nowMsProp]);

  const timeReached = useMemo(
    () => scheduledTimeReached(reminder, nowMs),
    [reminder, nowMs]
  );

  const canRegisterDose =
    (reminder.status === 'pending' || reminder.status === 'missed') &&
    !!onMarkTaken &&
    !!onMarkSkipped &&
    (timeReached || reminder.status === 'missed');

  const showAvailableHint =
    reminder.status === 'pending' && !timeReached && !!onMarkTaken;

  const compact = !isSeniorMode && fontScale < 1.2 && !isSmallPhone;
  const timeSize = compact ? (isSmallPhone ? 24 : 28) : isSmallPhone ? 28 : 34;
  const padV = compact ? Space[12] : Space[16];

  return (
    <SurfaceCard
      variant="default"
      style={{
        marginBottom: scaleSpacing(Space[12]),
        width: '100%',
        paddingVertical: scaleSpacing(padV),
      }}
    >
      <View style={[styles.header, isSmallPhone && styles.headerStack]}>
        <View style={styles.timeCol}>
          <AppText
            variant="timeDisplay"
            style={{
              color: isHighContrast ? undefined : BrandColors.navy,
              fontSize: scaleFont(timeSize),
              lineHeight: scaleFont(timeSize + 6),
              flexShrink: 1,
            }}
          >
            {formatTimeForDisplay(reminder.scheduledTime)}
          </AppText>
          <View style={{ marginTop: scaleSpacing(Space[8]), flexShrink: 1 }}>
            <StatusBadge status={reminder.status} />
          </View>
        </View>

        <View style={[styles.info, isSmallPhone && styles.infoFull]}>
          <AppText variant="medicationName" style={{ flexShrink: 1 }} numberOfLines={2}>
            {reminder.medicationName}
          </AppText>
          <AppText variant="body" tone="secondary" style={{ marginTop: 4, flexShrink: 1 }}>
            {reminder.dose}
          </AppText>
        </View>
      </View>

      <SpeakButton
        id={`reminder-${reminder.id}`}
        label="Escuchar"
        stopLabel="Detener"
        text={() => buildReminderSpeech(reminder)}
        style={{ marginTop: scaleSpacing(Space[12]), alignSelf: 'stretch' }}
      />

      {showAvailableHint ? (
        <AppText
          variant="caption"
          tone="secondary"
          style={{ marginTop: scaleSpacing(Space[12]), flexShrink: 1 }}
        >
          {`Disponible a las ${formatTimeForDisplay(reminder.scheduledTime)}`}
        </AppText>
      ) : null}

      {canRegisterDose ? (
        <>
          {reminder.status === 'missed' ? (
            <AppText
              variant="caption"
              tone="secondary"
              style={{ marginTop: scaleSpacing(Space[12]), flexShrink: 1 }}
            >
              ¿Qué ocurrió con esta toma?
            </AppText>
          ) : null}
          <DoseActions
            onTaken={onMarkTaken!}
            onMissed={onMarkSkipped!}
            takenLabel="Tomado"
            missedLabel="Omitir"
            loading={actionLoading}
            disabled={actionLoading}
          />
        </>
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 16,
    width: '100%',
  },
  headerStack: {
    flexDirection: 'column',
    gap: 12,
  },
  timeCol: {
    minWidth: 0,
    flexShrink: 1,
  },
  info: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  infoFull: {
    width: '100%',
  },
});
