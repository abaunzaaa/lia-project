import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { Medication } from '../types';
import {
  formatTimeForDisplay,
  getLocalDateString,
  getUpcomingLocalDates,
  localDateTimeFrom,
} from '../utils/dateTime';

/** Identifica notificaciones locales de LIA (no push). */
export const MEDICATION_REMINDER_TYPE = 'medication-reminder' as const;
export const STOCK_LOW_REMINDER_TYPE = 'stock-low-reminder' as const;

const PREF_KEY = 'lia_local_reminders_pref';
const SYNC_WINDOW_DAYS = 7;

export type MedicationReminderData = {
  type: typeof MEDICATION_REMINDER_TYPE;
  medicationId: string;
  scheduleId: string;
  date: string;
};

export type StockLowReminderData = {
  type: typeof STOCK_LOW_REMINDER_TYPE;
  medicationId: string;
};

let handlerConfigured = false;
let syncChain: Promise<SyncResult> = Promise.resolve({
  scheduled: 0,
  cancelled: 0,
});
let lastSyncAt = 0;

export type SyncResult = {
  scheduled: number;
  cancelled: number;
  skippedReason?: string;
};

/**
 * Handler único global — mostrar alerta también en foreground.
 */
export function configureNotificationHandler(): void {
  if (handlerConfigured) return;
  handlerConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function getNotificationPermissionStatus(): Promise<Notifications.PermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/**
 * Solicita permiso solo si aún no está concedido.
 * Si ya fue denegado, no vuelve a pedir (iOS no lo permite de forma útil).
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  if (current.status === 'denied' && !current.canAskAgain) return false;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

export async function canScheduleNotifications(): Promise<boolean> {
  const status = await getNotificationPermissionStatus();
  return status === 'granted';
}

/** Preferencia del usuario (SecureStore). Ausente → false (no asumir activo). */
export async function getPhoneRemindersPreference(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(PREF_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

export async function setPhoneRemindersPreference(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(PREF_KEY, enabled ? 'true' : 'false');
}

/**
 * Estado efectivo del switch: preferencia AND permiso del sistema.
 */
export async function getEffectivePhoneRemindersEnabled(): Promise<{
  preference: boolean;
  permissionGranted: boolean;
  effective: boolean;
  canAskAgain: boolean;
}> {
  const preference = await getPhoneRemindersPreference();
  const perms = await Notifications.getPermissionsAsync();
  const permissionGranted = perms.status === 'granted';
  return {
    preference,
    permissionGranted,
    effective: preference && permissionGranted,
    canAskAgain: perms.canAskAgain !== false,
  };
}

function isLiaLocalNotification(
  request: Notifications.NotificationRequest
): boolean {
  const data = request.content.data as { type?: string } | undefined;
  return (
    data?.type === MEDICATION_REMINDER_TYPE ||
    data?.type === STOCK_LOW_REMINDER_TYPE
  );
}

/** Cancela solo notificaciones locales de recordatorios y stock de LIA. */
export async function cancelLiaMedicationNotifications(): Promise<number> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    let cancelled = 0;
    for (const item of scheduled) {
      if (isLiaLocalNotification(item)) {
        await Notifications.cancelScheduledNotificationAsync(item.identifier);
        cancelled += 1;
      }
    }
    return cancelled;
  } catch (error) {
    if (__DEV__) {
      console.warn('[notifications] cancel failed', error);
    }
    return 0;
  }
}

/**
 * Sin fecha final: estima agotamiento y programa aviso ~1 semana antes.
 * Si quedan menos de 7 días, programa un aviso próximo razonable.
 * Evita duplicados al cancelar/reprogramar en cada sync.
 */
function computeStockLowTrigger(
  med: Medication,
  now: Date
): Date | null {
  const end = normalizeDateField(med.endDate);
  if (end) return null;

  const stock =
    typeof med.quantity === 'number' && Number.isFinite(med.quantity)
      ? Math.max(0, Math.floor(med.quantity))
      : null;
  if (stock == null) return null;

  const schedules = schedulesOf(med);
  if (schedules.length === 0) return null;

  const unitsPerIntake = Math.min(
    5,
    Math.max(1, Math.floor(med.unitsPerIntake ?? 1))
  );
  const unitsPerDay = schedules.length * unitsPerIntake;
  if (unitsPerDay <= 0) return null;

  const daysRemaining = Math.floor(stock / unitsPerDay);
  const trigger = new Date(now);

  if (daysRemaining <= 0) {
    // Ya se está terminando: aviso en ~2 horas (o mañana 9:00 si es de noche).
    trigger.setHours(trigger.getHours() + 2, 0, 0, 0);
    if (trigger.getTime() <= now.getTime()) {
      trigger.setTime(now.getTime() + 2 * 60 * 60 * 1000);
    }
  } else if (daysRemaining < 7) {
    // Menos de una semana: aviso mañana a las 9:00 (o en 1h si ya pasó).
    trigger.setDate(trigger.getDate() + 1);
    trigger.setHours(9, 0, 0, 0);
    if (trigger.getTime() <= now.getTime() + 60 * 60 * 1000) {
      trigger.setTime(now.getTime() + 60 * 60 * 1000);
    }
  } else {
    // Una semana antes del agotamiento estimado, a las 9:00.
    const daysUntilNotice = daysRemaining - 7;
    trigger.setDate(trigger.getDate() + daysUntilNotice);
    trigger.setHours(9, 0, 0, 0);
    if (trigger.getTime() <= now.getTime()) {
      trigger.setTime(now.getTime() + 60 * 60 * 1000);
    }
  }

  return trigger;
}

function normalizeDateField(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  return null;
}

function isMedicationActiveOnDate(med: Medication, dateYmd: string): boolean {
  const start = normalizeDateField(med.startDate);
  const end = normalizeDateField(med.endDate);
  if (start && dateYmd < start) return false;
  if (end && dateYmd > end) return false;
  return true;
}

function schedulesOf(med: Medication): { id: string; time: string }[] {
  if (med.schedules?.length) {
    return med.schedules.filter((s) => s.time);
  }
  if (med.time) {
    return [{ id: `${med.id}-legacy`, time: med.time }];
  }
  return [];
}

/**
 * Sincroniza notificaciones locales para los próximos 7 días + avisos de stock.
 * - Demo / preferencia off / sin permiso → cancela y no programa.
 * - Cancela previas de LIA antes de reprogramar (anti-duplicados).
 * - Se recalcula al editar medicamento, cambiar stock/horario o marcar Tomado
 *   (quien llame sync tras esos eventos).
 */
export async function syncMedicationNotifications(
  medications: Medication[],
  options?: { isDemo?: boolean; force?: boolean }
): Promise<SyncResult> {
  configureNotificationHandler();

  const run = async (): Promise<SyncResult> => {
    try {
      if (options?.isDemo) {
        const cancelled = await cancelLiaMedicationNotifications();
        return { scheduled: 0, cancelled, skippedReason: 'demo' };
      }

      const preference = await getPhoneRemindersPreference();
      if (!preference) {
        const cancelled = await cancelLiaMedicationNotifications();
        return { scheduled: 0, cancelled, skippedReason: 'preference-off' };
      }

      const allowed = await canScheduleNotifications();
      if (!allowed) {
        const cancelled = await cancelLiaMedicationNotifications();
        return { scheduled: 0, cancelled, skippedReason: 'permission-denied' };
      }

      if (!medications.length) {
        const cancelled = await cancelLiaMedicationNotifications();
        return { scheduled: 0, cancelled };
      }

      const cancelled = await cancelLiaMedicationNotifications();
      const now = Date.now();
      const nowDate = new Date(now);
      const dates = getUpcomingLocalDates(SYNC_WINDOW_DAYS);
      let scheduled = 0;

      for (const med of medications) {
        const schedules = schedulesOf(med);
        for (const date of dates) {
          if (!isMedicationActiveOnDate(med, date)) continue;

          for (const schedule of schedules) {
            const when = localDateTimeFrom(date, schedule.time);
            if (!when) continue;
            if (when.getTime() <= now) continue;

            const data: MedicationReminderData = {
              type: MEDICATION_REMINDER_TYPE,
              medicationId: med.id,
              scheduleId: schedule.id,
              date,
            };

            try {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: 'Es hora de tu medicamento',
                  body: `${med.name} · ${med.dose}\nTu toma está programada para las ${formatTimeForDisplay(schedule.time)}.`,
                  sound: true,
                  ...(Platform.OS === 'ios'
                    ? { interruptionLevel: 'timeSensitive' as const }
                    : {}),
                  ...(Platform.OS === 'android'
                    ? { channelId: 'lia-medication-reminders' }
                    : {}),
                  data,
                },
                trigger: {
                  type: Notifications.SchedulableTriggerInputTypes.DATE,
                  date: when,
                  ...(Platform.OS === 'android'
                    ? { channelId: 'lia-medication-reminders' }
                    : {}),
                },
              });
              scheduled += 1;
            } catch (error) {
              if (__DEV__) {
                console.warn('[notifications] schedule one failed', med.id, schedule.time, error);
              }
            }
          }
        }

        const stockWhen = computeStockLowTrigger(med, nowDate);
        if (stockWhen && stockWhen.getTime() > now) {
          const stockData: StockLowReminderData = {
            type: STOCK_LOW_REMINDER_TYPE,
            medicationId: med.id,
          };
          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'Tu medicamento se está terminando',
                body: `Según tus tomas programadas, pronto necesitarás más ${med.name}.`,
                sound: true,
                ...(Platform.OS === 'ios'
                  ? { interruptionLevel: 'timeSensitive' as const }
                  : {}),
                ...(Platform.OS === 'android'
                  ? { channelId: 'lia-medication-reminders' }
                  : {}),
                data: stockData,
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: stockWhen,
                ...(Platform.OS === 'android'
                  ? { channelId: 'lia-medication-reminders' }
                  : {}),
              },
            });
            scheduled += 1;
          } catch (error) {
            if (__DEV__) {
              console.warn('[notifications] stock-low schedule failed', med.id, error);
            }
          }
        }
      }

      lastSyncAt = Date.now();
      if (__DEV__) {
        console.log(
          `[notifications] sync: cancelled=${cancelled} scheduled=${scheduled} window=${SYNC_WINDOW_DAYS}d`
        );
      }
      return { scheduled, cancelled };
    } catch (error) {
      if (__DEV__) {
        console.warn('[notifications] sync failed', error);
      }
      return { scheduled: 0, cancelled: 0, skippedReason: 'error' };
    }
  };

  /** Encadena para no perder el último set de medicamentos. */
  const next = syncChain.then(run, run);
  syncChain = next.then(
    (r) => r,
    () => ({ scheduled: 0, cancelled: 0, skippedReason: 'error' })
  );
  return next;
}

/**
 * Activa preferencia + permiso + sync.
 * No pide permiso si ya está denegado sin canAskAgain.
 */
export async function enablePhoneReminders(
  medications: Medication[],
  options?: { isDemo?: boolean }
): Promise<{ ok: boolean; message?: string }> {
  if (options?.isDemo) {
    await setPhoneRemindersPreference(false);
    await cancelLiaMedicationNotifications();
    return {
      ok: false,
      message: 'En modo demo no se programan recordatorios del teléfono.',
    };
  }

  const perms = await Notifications.getPermissionsAsync();
  if (perms.status !== 'granted') {
    if (perms.status === 'denied' && perms.canAskAgain === false) {
      await setPhoneRemindersPreference(false);
      return {
        ok: false,
        message:
          'Las notificaciones están desactivadas. Puedes activarlas desde la configuración de tu teléfono para que LIA pueda avisarte a tiempo.',
      };
    }
    const granted = await requestNotificationPermission();
    if (!granted) {
      await setPhoneRemindersPreference(false);
      return {
        ok: false,
        message:
          'Las notificaciones están desactivadas. Puedes activarlas desde la configuración de tu teléfono para que LIA pueda avisarte a tiempo.',
      };
    }
  }

  await setPhoneRemindersPreference(true);
  const result = await syncMedicationNotifications(medications, {
    isDemo: false,
  });

  if (result.skippedReason === 'error') {
    return {
      ok: false,
      message: 'No pudimos activar los recordatorios del teléfono.',
    };
  }

  return { ok: true };
}

export async function disablePhoneReminders(): Promise<void> {
  await setPhoneRemindersPreference(false);
  await cancelLiaMedicationNotifications();
}

/**
 * SOLO desarrollo: programa una notificación de prueba en ~60 segundos.
 * No se expone en la UI de producción.
 *
 * Uso (consola / debugger):
 *   import { scheduleDevTestNotification } from './src/services/notificationService';
 *   await scheduleDevTestNotification();
 */
export async function scheduleDevTestNotification(): Promise<string | null> {
  if (!__DEV__) {
    console.warn('[notifications] scheduleDevTestNotification solo en desarrollo');
    return null;
  }

  configureNotificationHandler();
  const granted = await requestNotificationPermission();
  if (!granted) return null;

  const when = new Date(Date.now() + 60_000);
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Es hora de tu medicamento',
      body: 'Prueba · LIA (desarrollo)\nTu toma está programada para dentro de 1 minuto.',
      sound: true,
      data: {
        type: MEDICATION_REMINDER_TYPE,
        medicationId: 'dev-test',
        scheduleId: 'dev-test',
        date: getLocalDateString(),
      } satisfies MedicationReminderData,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
    },
  });

  console.log('[notifications] prueba programada en ~60s id=', id);
  return id;
}

export function isMedicationReminderResponse(
  response: Notifications.NotificationResponse
): boolean {
  const data = response.notification.request.content.data as { type?: string } | undefined;
  return data?.type === MEDICATION_REMINDER_TYPE;
}

/** Evita resync agresivo al volver al foreground (< 30s). */
export function shouldSyncOnForeground(): boolean {
  return Date.now() - lastSyncAt > 30_000;
}

/**
 * Android: canal por defecto (Expo Go / builds).
 */
export async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('lia-medication-reminders', {
      name: 'Recordatorios de medicamentos',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch (error) {
    if (__DEV__) console.warn('[notifications] channel failed', error);
  }
}

/** Compat: nombre antiguo usado en Settings. */
export async function requestNotificationPermissions(): Promise<boolean> {
  return requestNotificationPermission();
}
