import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { FontFamily, FontWeight, Space } from '../theme/tokens';
import { useAccessibility } from '../context/AccessibilityContext';
import { BrandColors, liaCardBorder } from '../theme/brand';
import { useTheme } from '../context/ThemeContext';
import { formatTimeForDisplay } from '../utils/dateTime';
import { Reminder } from '../types';
import AppText from './AppText';
import StatusBadge from './StatusBadge';
import DoseActions from './DoseActions';
import SpeakButton from './SpeakButton';
import { buildReminderSpeech } from '../utils/speechPhrases';

const SUN_ICON = require('../assets/images/lia-dose-sun.png');
const MOON_ICON = require('../assets/images/lia-dose-moon.png');

interface ReminderCardProps {
  reminder: Reminder;
  onMarkTaken?: () => void;
  onMarkSkipped?: () => void;
  actionLoading?: boolean;
  nowMs?: number;
  isFirst?: boolean;
  isLast?: boolean;
}

function scheduledTimeReached(reminder: Reminder, nowMs: number): boolean {
  const scheduled = Date.parse(reminder.scheduledFor);
  if (!Number.isNaN(scheduled)) {
    return nowMs >= scheduled;
  }
  const [h, m] = (reminder.scheduledTime || '00:00').split(':').map((n) => parseInt(n, 10));
  const d = new Date(nowMs);
  const minsNow = d.getHours() * 60 + d.getMinutes();
  const minsSched = (h || 0) * 60 + (m || 0);
  return minsNow >= minsSched;
}

function isMorningDose(scheduledTime: string): boolean {
  const hour = parseInt((scheduledTime || '00:00').split(':')[0], 10);
  return Number.isFinite(hour) && hour < 12;
}

export default function ReminderCard({
  reminder,
  onMarkTaken,
  onMarkSkipped,
  actionLoading = false,
  nowMs: nowMsProp,
  isLast = false,
}: ReminderCardProps) {
  const { scaleSpacing } = useAccessibility();
  const { isHighContrast, isDark, colors } = useTheme();
  const lightChrome = !isDark && !isHighContrast;

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

  const morning = isMorningDose(reminder.scheduledTime);
  const ink = lightChrome ? BrandColors.navy : colors.textPrimary;

  return (
    <View style={{ marginBottom: isLast ? 0 : scaleSpacing(Space[12]), width: '100%' }}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: lightChrome ? BrandColors.white : colors.surface,
            borderColor: liaCardBorder(lightChrome, colors.border),
            borderWidth: isHighContrast ? 2 : 1,
            padding: scaleSpacing(Space[12]),
          },
        ]}
      >
        <View style={styles.topRow}>
          <View
            style={styles.periodIcon}
            accessibilityLabel={morning ? 'Toma de mañana' : 'Toma de noche'}
          >
            <Image
              source={morning ? SUN_ICON : MOON_ICON}
              style={styles.periodArt}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </View>
          <View style={styles.topCopy}>
            <View style={styles.nameRow}>
              <AppText
                variant="medicationName"
                style={{
                  color: ink,
                  fontFamily: FontFamily.semiBold,
                  fontWeight: FontWeight.semiBold,
                  flex: 1,
                  minWidth: 0,
                }}
                numberOfLines={2}
              >
                {reminder.medicationName}
              </AppText>
              <View style={styles.badgeWrap}>
                <StatusBadge status={reminder.status} />
              </View>
            </View>
            <AppText
              variant="h3"
              style={{
                marginTop: 2,
                color: ink,
                fontFamily: FontFamily.semiBold,
                fontWeight: FontWeight.semiBold,
              }}
            >
              {formatTimeForDisplay(reminder.scheduledTime)}
            </AppText>
            <AppText
              variant="body"
              style={{
                marginTop: scaleSpacing(Space[4]),
                color: lightChrome ? BrandColors.teal : colors.textSecondary,
                flexShrink: 1,
              }}
            >
              {reminder.dose}
            </AppText>
          </View>
        </View>

        <SpeakButton
          id={`reminder-${reminder.id}`}
          label="Escuchar"
          stopLabel="Detener"
          text={() => buildReminderSpeech(reminder)}
          textVariant="button"
          compact
          style={{
            marginTop: scaleSpacing(Space[8]),
            backgroundColor: lightChrome ? '#E8ECEF' : colors.surfaceElevated,
            borderColor: lightChrome ? '#E8ECEF' : colors.border,
          }}
        />

        {canRegisterDose ? (
          <DoseActions
            onTaken={onMarkTaken!}
            onMissed={onMarkSkipped!}
            takenLabel="Tomado"
            missedLabel="Omitir"
            loading={actionLoading}
            disabled={actionLoading}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  periodIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  periodArt: {
    width: 52,
    height: 52,
  },
  topCopy: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeWrap: {
    flexShrink: 0,
    maxWidth: '48%',
  },
});
