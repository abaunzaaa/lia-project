import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { useMedications } from './MedicationContext';
import { getReminders } from '../services/reminderApi';
import { setIntakeStatus } from '../services/intakeApi';
import { getHistory, hideHistoryDose } from '../services/historyApi';
import { getAdherence } from '../services/adherenceApi';
import { ApiClientError } from '../services/apiClient';
import {
  AdherenceSummary,
  HistoryEntry,
  NextDoseGroup,
  Reminder,
} from '../types';
import {
  getDeviceTimeZone,
  getLocalDateRange,
  getLocalDateString,
} from '../utils/dateTime';
import { syncMedicationNotifications } from '../services/notificationService';

const HISTORY_DAYS = 7;

interface ReminderContextType {
  reminders: Reminder[];
  remindersDate: string;
  remindersLoading: boolean;
  refreshReminders: (date?: string, options?: { silent?: boolean }) => Promise<void>;
  markTaken: (reminder: Reminder) => Promise<void>;
  markSkipped: (reminder: Reminder) => Promise<void>;
  actingReminderId: string | null;

  history: HistoryEntry[];
  historyLoading: boolean;
  refreshHistory: () => Promise<void>;
  hideHistoryEntry: (entry: HistoryEntry) => Promise<void>;

  adherence: AdherenceSummary | null;
  adherenceLoading: boolean;
  refreshAdherence: () => Promise<void>;

  /** Próximo horario: pending futuros agrupados por date+time. */
  nextDoseGroup: NextDoseGroup | null;
  todayReminders: Reminder[];
  homeLoading: boolean;
  refreshHome: () => Promise<void>;

  /** Invalidar tras CRUD de medicamentos. */
  invalidateAfterMedicationChange: () => Promise<void>;
}

const ReminderContext = createContext<ReminderContextType | undefined>(undefined);

function medsFingerprint(
  meds: { id: string; schedules: { id: string; time: string }[] }[]
): string {
  return meds
    .map((m) => `${m.id}:${m.schedules.map((s) => `${s.id}-${s.time}`).join(',')}`)
    .sort()
    .join('|');
}

function buildDemoReminders(
  meds: {
    id: string;
    name: string;
    dose: string;
    time: string;
    schedules: { id: string; time: string }[];
  }[],
  date: string,
  statusMap: Record<string, Reminder['status']>
): Reminder[] {
  const list: Reminder[] = [];
  const now = Date.now();
  for (const m of meds) {
    const schedules =
      m.schedules?.length > 0
        ? m.schedules
        : [{ id: `${m.id}-s0`, time: m.time }];
    for (const s of schedules) {
      const id = `demo-${m.id}-${s.id}-${date}`;
      const scheduledFor = `${date}T${s.time}:00`;
      const mapped = statusMap[id];
      let status: Reminder['status'] = mapped || 'pending';
      if (!mapped) {
        const t = Date.parse(scheduledFor);
        if (!Number.isNaN(t) && t <= now) status = 'missed';
      }
      list.push({
        id,
        medicationId: m.id,
        scheduleId: s.id,
        medicationName: m.name,
        dose: m.dose,
        scheduledTime: s.time,
        date,
        scheduledFor,
        status,
        intakeId: mapped ? `demo-intake-${id}` : null,
        actionAt: mapped ? new Date().toISOString() : null,
        userId: 'demo-user',
      });
    }
  }
  return list.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
}

/** Clave estable: date + HH:mm (no usar texto visual). */
function doseGroupKey(r: Reminder): string {
  return `${r.date}|${r.scheduledTime}`;
}

/**
 * Próximo horario futuro con todos los medicamentos pending a esa hora.
 * missed no bloquea: solo pending + scheduledFor > ahora.
 */
export function computeNextDoseGroup(todayList: Reminder[]): NextDoseGroup | null {
  const now = Date.now();
  const upcoming = todayList
    .filter((r) => r.status === 'pending')
    .filter((r) => {
      const t = Date.parse(r.scheduledFor);
      return !Number.isNaN(t) && t > now;
    })
    .sort((a, b) => Date.parse(a.scheduledFor) - Date.parse(b.scheduledFor));

  if (upcoming.length === 0) return null;

  const firstKey = doseGroupKey(upcoming[0]);
  const group = upcoming.filter((r) => doseGroupKey(r) === firstKey);

  return {
    time: group[0].scheduledTime,
    date: group[0].date,
    scheduledFor: group[0].scheduledFor,
    items: group.map((r) => ({
      reminderId: r.id,
      medicationName: r.medicationName,
      dose: r.dose,
    })),
  };
}

export function ReminderProvider({ children }: { children: ReactNode }) {
  const { user, isDemo } = useAuth();
  const { medications, loading: medsLoading, refreshMedications } = useMedications();

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [remindersDate, setRemindersDate] = useState(getLocalDateString());
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [actingReminderId, setActingReminderId] = useState<string | null>(null);

  const [todayReminders, setTodayReminders] = useState<Reminder[]>([]);
  const [homeLoading, setHomeLoading] = useState(false);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [adherence, setAdherence] = useState<AdherenceSummary | null>(null);
  const [adherenceLoading, setAdherenceLoading] = useState(false);

  /** Demo: estados locales de tomado/omitido. */
  const [demoStatusMap, setDemoStatusMap] = useState<Record<string, Reminder['status']>>({});
  const [demoHistory, setDemoHistory] = useState<HistoryEntry[]>([]);

  const clearAll = useCallback(() => {
    setReminders([]);
    setTodayReminders([]);
    setHistory([]);
    setAdherence(null);
    setDemoStatusMap({});
    setDemoHistory([]);
    setActingReminderId(null);
    setRemindersLoading(false);
    setHomeLoading(false);
    setHistoryLoading(false);
    setAdherenceLoading(false);
  }, []);

  const refreshReminders = useCallback(
    async (date?: string, options?: { silent?: boolean }) => {
      const target = date || remindersDate || getLocalDateString();
      setRemindersDate(target);

      if (!user) {
        setReminders([]);
        return;
      }

      if (isDemo) {
        setReminders(buildDemoReminders(medications, target, demoStatusMap));
        return;
      }

      if (!options?.silent) setRemindersLoading(true);
      try {
        const tz = getDeviceTimeZone();
        const data = await getReminders(target, tz);
        setReminders(data);
        if (target === getLocalDateString()) {
          setTodayReminders(data);
        }
      } catch (error) {
        if (!options?.silent) setReminders([]);
        if (__DEV__) {
          console.warn('[reminders] load failed', error);
        }
        throw error;
      } finally {
        if (!options?.silent) setRemindersLoading(false);
      }
    },
    [user, isDemo, medications, demoStatusMap, remindersDate]
  );

  const refreshHome = useCallback(async () => {
    if (!user) {
      setTodayReminders([]);
      return;
    }

    const today = getLocalDateString();

    if (isDemo) {
      setTodayReminders(buildDemoReminders(medications, today, demoStatusMap));
      return;
    }

    setHomeLoading(true);
    try {
      const data = await getReminders(today, getDeviceTimeZone());
      setTodayReminders(data);
      if (remindersDate === today) {
        setReminders(data);
      }
    } catch (error) {
      setTodayReminders([]);
      if (__DEV__) console.warn('[reminders:home] failed', error);
    } finally {
      setHomeLoading(false);
    }
  }, [user, isDemo, medications, demoStatusMap, remindersDate]);

  const refreshHistory = useCallback(async () => {
    if (!user) {
      setHistory([]);
      return;
    }

    if (isDemo) {
      setHistory(demoHistory);
      return;
    }

    setHistoryLoading(true);
    try {
      const { from, to } = getLocalDateRange(HISTORY_DAYS);
      const data = await getHistory(from, to, getDeviceTimeZone());
      setHistory(data);
    } catch (error) {
      setHistory([]);
      if (__DEV__) console.warn('[history] load failed', error);
      throw error;
    } finally {
      setHistoryLoading(false);
    }
  }, [user, isDemo, demoHistory]);

  const hideHistoryEntry = useCallback(
    async (entry: HistoryEntry) => {
      if (!user) {
        throw new ApiClientError('Tu sesión expiró. Vuelve a iniciar sesión.', 401);
      }

      if (isDemo) {
        setDemoHistory((prev) => prev.filter((item) => item.id !== entry.id));
        return;
      }

      await hideHistoryDose({
        medicationId: entry.medicationId,
        scheduleId: entry.scheduleId,
        date: entry.date,
        timezone: getDeviceTimeZone(),
      });
      await refreshHistory().catch(() => undefined);
    },
    [user, isDemo, refreshHistory]
  );

  const refreshAdherence = useCallback(async () => {
    if (!user) {
      setAdherence(null);
      return;
    }

    if (isDemo) {
      const taken = demoHistory.filter((h) => h.status === 'taken').length;
      const skipped = demoHistory.filter((h) => h.status === 'skipped').length;
      const total = taken + skipped;
      setAdherence({
        totalScheduled: total,
        taken,
        skipped,
        missed: 0,
        percentage: total > 0 ? Math.round((taken / total) * 100) : null,
      });
      return;
    }

    setAdherenceLoading(true);
    try {
      const { from, to } = getLocalDateRange(HISTORY_DAYS);
      const data = await getAdherence(from, to, getDeviceTimeZone());
      setAdherence(data);
    } catch (error) {
      setAdherence(null);
      if (__DEV__) console.warn('[adherence] load failed', error);
      throw error;
    } finally {
      setAdherenceLoading(false);
    }
  }, [user, isDemo, demoHistory]);

  const refreshAfterIntake = useCallback(
    async (date: string) => {
      await Promise.all([
        refreshReminders(date, { silent: true }),
        refreshHome(),
        refreshHistory().catch(() => undefined),
        refreshAdherence().catch(() => undefined),
        refreshMedications().catch(() => undefined),
      ]);
      // Stock/notificaciones: useNotificationLifecycle re-sincroniza al actualizar medications.
    },
    [
      refreshReminders,
      refreshHome,
      refreshHistory,
      refreshAdherence,
      refreshMedications,
    ]
  );

  const markTaken = useCallback(
    async (reminder: Reminder) => {
      if (!user || actingReminderId) return;
      setActingReminderId(reminder.id);

      try {
        if (isDemo) {
          setDemoStatusMap((prev) => ({ ...prev, [reminder.id]: 'taken' }));
          const entry: HistoryEntry = {
            id: `demo-hist-${reminder.id}`,
            medicationId: reminder.medicationId,
            scheduleId: reminder.scheduleId,
            medicationName: reminder.medicationName,
            dose: reminder.dose,
            date: reminder.date,
            time: reminder.scheduledTime,
            scheduledFor: reminder.scheduledFor,
            status: 'taken',
            actionAt: new Date().toISOString(),
            intakeId: reminder.intakeId,
          };
          setDemoHistory((prev) => [entry, ...prev.filter((h) => h.id !== entry.id)]);
          setReminders((prev) =>
            prev.map((r) => (r.id === reminder.id ? { ...r, status: 'taken' } : r))
          );
          setTodayReminders((prev) =>
            prev.map((r) => (r.id === reminder.id ? { ...r, status: 'taken' } : r))
          );
          return;
        }

        await setIntakeStatus({
          medicationId: reminder.medicationId,
          scheduleId: reminder.scheduleId,
          date: reminder.date,
          timezone: getDeviceTimeZone(),
          status: 'taken',
        });
        await refreshAfterIntake(reminder.date);
      } finally {
        setActingReminderId(null);
      }
    },
    [user, isDemo, actingReminderId, refreshAfterIntake]
  );

  const markSkipped = useCallback(
    async (reminder: Reminder) => {
      if (!user || actingReminderId) return;
      setActingReminderId(reminder.id);

      try {
        if (isDemo) {
          setDemoStatusMap((prev) => ({ ...prev, [reminder.id]: 'skipped' }));
          const entry: HistoryEntry = {
            id: `demo-hist-${reminder.id}`,
            medicationId: reminder.medicationId,
            scheduleId: reminder.scheduleId,
            medicationName: reminder.medicationName,
            dose: reminder.dose,
            date: reminder.date,
            time: reminder.scheduledTime,
            scheduledFor: reminder.scheduledFor,
            status: 'skipped',
            actionAt: new Date().toISOString(),
            intakeId: reminder.intakeId,
          };
          setDemoHistory((prev) => [entry, ...prev.filter((h) => h.id !== entry.id)]);
          setReminders((prev) =>
            prev.map((r) => (r.id === reminder.id ? { ...r, status: 'skipped' } : r))
          );
          setTodayReminders((prev) =>
            prev.map((r) => (r.id === reminder.id ? { ...r, status: 'skipped' } : r))
          );
          return;
        }

        await setIntakeStatus({
          medicationId: reminder.medicationId,
          scheduleId: reminder.scheduleId,
          date: reminder.date,
          timezone: getDeviceTimeZone(),
          status: 'skipped',
        });
        await refreshAfterIntake(reminder.date);
      } finally {
        setActingReminderId(null);
      }
    },
    [user, isDemo, actingReminderId, refreshAfterIntake]
  );

  const invalidateAfterMedicationChange = useCallback(async () => {
    if (!user) return;
    if (isDemo) {
      const today = getLocalDateString();
      setTodayReminders(buildDemoReminders(medications, today, demoStatusMap));
      setReminders(buildDemoReminders(medications, remindersDate, demoStatusMap));
      void syncMedicationNotifications(medications, { isDemo: true });
      return;
    }
    await Promise.all([
      refreshHome(),
      refreshReminders(remindersDate).catch(() => undefined),
      refreshHistory().catch(() => undefined),
      refreshAdherence().catch(() => undefined),
      syncMedicationNotifications(medications, { isDemo: false }),
    ]);
  }, [
    user,
    isDemo,
    medications,
    demoStatusMap,
    remindersDate,
    refreshHome,
    refreshReminders,
    refreshHistory,
    refreshAdherence,
  ]);

  const fingerprint = useMemo(() => medsFingerprint(medications), [medications]);
  const prevFingerprint = React.useRef<string | null>(null);

  /** Logout / cambio de cuenta: limpiar ya. */
  useEffect(() => {
    prevFingerprint.current = null;

    if (!user) {
      clearAll();
      return;
    }

    if (isDemo) {
      const today = getLocalDateString();
      setRemindersDate(today);
      setReminders(buildDemoReminders(medications, today, demoStatusMap));
      setTodayReminders(buildDemoReminders(medications, today, demoStatusMap));
      setHistory(demoHistory);
      const taken = demoHistory.filter((h) => h.status === 'taken').length;
      const skipped = demoHistory.filter((h) => h.status === 'skipped').length;
      const total = taken + skipped;
      setAdherence({
        totalScheduled: total,
        taken,
        skipped,
        missed: 0,
        percentage: total > 0 ? Math.round((taken / total) * 100) : null,
      });
      return;
    }

    clearAll();
    setRemindersDate(getLocalDateString());
    setRemindersLoading(true);
    setHomeLoading(true);
    setHistoryLoading(true);
    setAdherenceLoading(true);

    let cancelled = false;
    (async () => {
      try {
        const today = getLocalDateString();
        const tz = getDeviceTimeZone();
        const { from, to } = getLocalDateRange(HISTORY_DAYS);
        const [rems, hist, adh] = await Promise.all([
          getReminders(today, tz),
          getHistory(from, to, tz),
          getAdherence(from, to, tz),
        ]);
        if (cancelled) return;
        setReminders(rems);
        setTodayReminders(rems);
        setHistory(hist);
        setAdherence(adh);
        prevFingerprint.current = medsFingerprint(medications);
      } catch {
        if (!cancelled) {
          setReminders([]);
          setTodayReminders([]);
          setHistory([]);
          setAdherence(null);
        }
      } finally {
        if (!cancelled) {
          setRemindersLoading(false);
          setHomeLoading(false);
          setHistoryLoading(false);
          setAdherenceLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Solo al cambiar identidad
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, isDemo, clearAll]);

  /** Tras CRUD de medicamentos: refrescar dosis reales (omite la primera carga). */
  useEffect(() => {
    if (!user || isDemo || medsLoading) return;
    if (prevFingerprint.current === fingerprint) return;
    if (prevFingerprint.current === null) {
      prevFingerprint.current = fingerprint;
      return;
    }
    prevFingerprint.current = fingerprint;
    void invalidateAfterMedicationChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint, medsLoading, user?.uid, isDemo]);

  /** Demo: sincronizar reminders cuando cambian meds o status map. */
  useEffect(() => {
    if (!user || !isDemo) return;
    setReminders(buildDemoReminders(medications, remindersDate, demoStatusMap));
    setTodayReminders(buildDemoReminders(medications, getLocalDateString(), demoStatusMap));
    setHistory(demoHistory);
    const taken = demoHistory.filter((h) => h.status === 'taken').length;
    const skipped = demoHistory.filter((h) => h.status === 'skipped').length;
    const total = taken + skipped;
    setAdherence({
      totalScheduled: total,
      taken,
      skipped,
      missed: 0,
      percentage: total > 0 ? Math.round((taken / total) * 100) : null,
    });
  }, [user, isDemo, medications, remindersDate, demoStatusMap, demoHistory]);

  const nextDoseGroup = useMemo(
    () => computeNextDoseGroup(todayReminders),
    [todayReminders]
  );

  return (
    <ReminderContext.Provider
      value={{
        reminders,
        remindersDate,
        remindersLoading,
        refreshReminders,
        markTaken,
        markSkipped,
        actingReminderId,
        history,
        historyLoading,
        refreshHistory,
        hideHistoryEntry,
        adherence,
        adherenceLoading,
        refreshAdherence,
        nextDoseGroup,
        todayReminders,
        homeLoading,
        refreshHome,
        invalidateAfterMedicationChange,
      }}
    >
      {children}
    </ReminderContext.Provider>
  );
}

export function useReminders() {
  const context = useContext(ReminderContext);
  if (!context) throw new Error('useReminders debe usarse dentro de ReminderProvider');
  return context;
}

export { ApiClientError };
