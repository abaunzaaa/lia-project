import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import {
  syncMedicationNotifications,
} from '../services/notificationService';
import {
  getMedications as apiGetMedications,
  createMedication as apiCreateMedication,
  updateMedication as apiUpdateMedication,
  deleteMedication as apiDeleteMedication,
  MedicationApiError,
} from '../services/medicationApi';
import { useAuth } from './AuthContext';
import { Medication, MedicationFormData } from '../types';
import { generateId, normalizeScheduleTimes } from '../utils/helpers';
import { getLocalDateString } from '../utils/dateTime';
import { getMedicationImage } from '../config/medicationImages';

interface MedicationContextType {
  medications: Medication[];
  loading: boolean;
  loadMedications: () => Promise<void>;
  refreshMedications: () => Promise<void>;
  addMedication: (data: MedicationFormData) => Promise<Medication>;
  updateMedication: (id: string, data: Partial<MedicationFormData>) => Promise<Medication>;
  removeMedication: (id: string) => Promise<void>;
}

/** Solo para flujo demo explícito (María García) — nunca se envía a PostgreSQL. */
const DEMO_MEDICATIONS: Medication[] = [
  {
    id: 'demo-1',
    userId: 'demo-user',
    name: 'Losartán',
    dose: '50 mg',
    quantity: 1,
    frequency: '24h',
    time: '08:00',
    schedules: [{ id: 'demo-1-s1', time: '08:00' }],
    startDate: getLocalDateString(),
    description: 'Sirve para controlar la presión arterial alta.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-2',
    userId: 'demo-user',
    name: 'Metformina',
    dose: '850 mg',
    quantity: 1,
    frequency: '12h',
    time: '14:00',
    schedules: [{ id: 'demo-2-s1', time: '14:00' }],
    startDate: getLocalDateString(),
    description: 'Ayuda a controlar los niveles de azúcar en sangre.',
    createdAt: new Date().toISOString(),
  },
];

function formToApiPayload(data: MedicationFormData | Partial<MedicationFormData>) {
  const schedules =
    data.schedules !== undefined ? normalizeScheduleTimes(data.schedules) : undefined;

  return {
    name: data.name?.trim(),
    dose: data.dose?.trim(),
    frequency: data.frequency?.trim() || null,
    amount:
      data.quantity !== undefined && data.quantity !== null
        ? Math.max(0, Math.floor(data.quantity))
        : undefined,
    unitsPerIntake:
      data.unitsPerIntake !== undefined && data.unitsPerIntake !== null
        ? Math.max(1, Math.floor(data.unitsPerIntake))
        : undefined,
    startDate: data.startDate?.trim() || null,
    endDate: data.endDate?.trim() || null,
    instructions: data.description?.trim() || null,
    presentation: data.presentation !== undefined ? data.presentation : undefined,
    doseAmount: data.doseAmount !== undefined ? data.doseAmount : undefined,
    doseUnit: data.doseUnit !== undefined ? data.doseUnit : undefined,
    purpose: data.purpose !== undefined ? data.purpose.trim() || null : undefined,
    weekdays: data.weekdays !== undefined ? data.weekdays : undefined,
    mealRelation: data.mealRelation !== undefined ? data.mealRelation : undefined,
    reminderEnabled: data.reminderEnabled,
    schedules,
  };
}

function attachCatalogImage(med: Medication): Medication {
  return {
    ...med,
    imageUrl: med.imageUrl || getMedicationImage(med.name),
  };
}

function localMedicationFromForm(
  data: MedicationFormData,
  id: string,
  userId: string
): Medication {
  const times = normalizeScheduleTimes(data.schedules);
  return {
    id,
    userId,
    name: data.name.trim(),
    dose: data.dose.trim(),
    quantity: data.quantity ?? 1,
    unitsPerIntake: data.unitsPerIntake,
    frequency: data.frequency?.trim() || '',
    time: times[0] || '08:00',
    schedules: times.map((t, i) => ({ id: `${id}-s${i}`, time: t })),
    startDate: data.startDate?.trim() || getLocalDateString(),
    endDate: data.endDate?.trim() || undefined,
    description: data.description?.trim() || undefined,
    presentation: data.presentation ?? null,
    doseAmount: data.doseAmount ?? null,
    doseUnit: data.doseUnit ?? null,
    purpose: data.purpose?.trim() || undefined,
    weekdays: data.weekdays ?? null,
    mealRelation: data.mealRelation ?? null,
    reminderEnabled: data.reminderEnabled !== false,
    imageUrl: data.imageUrl || getMedicationImage(data.name),
    createdAt: new Date().toISOString(),
  };
}

const MedicationContext = createContext<MedicationContextType | undefined>(undefined);

export function MedicationProvider({ children }: { children: ReactNode }) {
  const { user, isDemo } = useAuth();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMedications = useCallback(async () => {
    if (!user) {
      setMedications([]);
      setLoading(false);
      return;
    }

    if (isDemo) {
      setMedications(DEMO_MEDICATIONS.map(attachCatalogImage));
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await apiGetMedications();
      setMedications(data.map(attachCatalogImage));
    } catch (error) {
      setMedications([]);
      if (__DEV__) {
        console.warn('[medications] load failed', error);
      }
    } finally {
      setLoading(false);
    }
  }, [user, isDemo]);

  const refreshMedications = useCallback(async () => {
    await loadMedications();
  }, [loadMedications]);

  useEffect(() => {
    if (!user) {
      setMedications([]);
      setLoading(false);
      return;
    }

    if (isDemo) {
      setMedications(DEMO_MEDICATIONS.map(attachCatalogImage));
      setLoading(false);
      return;
    }

    setMedications([]);
    setLoading(true);

    let cancelled = false;
    (async () => {
      try {
        const data = await apiGetMedications();
        if (!cancelled) setMedications(data.map(attachCatalogImage));
      } catch {
        if (!cancelled) setMedications([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, isDemo]);

  const addMedication = useCallback(
    async (data: MedicationFormData) => {
      if (!user) {
        throw new Error('Debes iniciar sesión para agregar medicamentos.');
      }

      if (isDemo) {
        const newMed = localMedicationFromForm(data, generateId(), 'demo-user');
        setMedications((prev) => [newMed, ...prev]);
        return newMed;
      }

      const payload = formToApiPayload(data);
      if (!payload.name || !payload.dose) {
        throw new Error('Completa nombre y dosis.');
      }

      const saved = attachCatalogImage(
        await apiCreateMedication({
          name: payload.name,
          dose: payload.dose,
          frequency: payload.frequency,
          amount: payload.amount ?? null,
          ...(payload.unitsPerIntake !== undefined
            ? { unitsPerIntake: payload.unitsPerIntake }
            : {}),
          startDate: payload.startDate,
          endDate: payload.endDate,
          instructions: payload.instructions,
          presentation: payload.presentation ?? null,
          doseAmount: payload.doseAmount ?? null,
          doseUnit: payload.doseUnit ?? null,
          purpose: payload.purpose ?? null,
          weekdays: payload.weekdays ?? null,
          mealRelation: payload.mealRelation ?? null,
          reminderEnabled: payload.reminderEnabled !== false,
          schedules: payload.schedules ?? [],
        })
      );

      setMedications((prev) => [saved, ...prev]);
      void syncMedicationNotifications([saved, ...medications.filter((m) => m.id !== saved.id)], {
        isDemo: false,
      });
      return saved;
    },
    [user, isDemo, medications]
  );

  const updateMedication = useCallback(
    async (id: string, data: Partial<MedicationFormData>) => {
      if (!user) {
        throw new Error('Debes iniciar sesión para editar medicamentos.');
      }

      if (isDemo) {
        let result: Medication | null = null;
        setMedications((prev) =>
          prev.map((m) => {
            if (m.id !== id) return m;
            const schedules =
              data.schedules !== undefined
                ? normalizeScheduleTimes(data.schedules).map((t, i) => ({
                    id: `${id}-s${i}`,
                    time: t,
                  }))
                : m.schedules;
            const times = schedules.map((s) => s.time);
            const next: Medication = {
              ...m,
              name: data.name?.trim() ?? m.name,
              dose: data.dose?.trim() ?? m.dose,
              quantity: data.quantity ?? m.quantity,
              unitsPerIntake:
                data.unitsPerIntake !== undefined ? data.unitsPerIntake : m.unitsPerIntake,
              frequency: data.frequency?.trim() ?? m.frequency,
              time: times[0] || m.time,
              schedules,
              startDate: data.startDate?.trim() ?? m.startDate,
              endDate: data.endDate !== undefined ? data.endDate?.trim() || undefined : m.endDate,
              description:
                data.description !== undefined
                  ? data.description.trim() || undefined
                  : m.description,
              presentation:
                data.presentation !== undefined ? data.presentation : m.presentation,
              doseAmount: data.doseAmount !== undefined ? data.doseAmount : m.doseAmount,
              doseUnit: data.doseUnit !== undefined ? data.doseUnit : m.doseUnit,
              purpose: data.purpose !== undefined ? data.purpose.trim() || undefined : m.purpose,
              weekdays: data.weekdays !== undefined ? data.weekdays : m.weekdays,
              mealRelation:
                data.mealRelation !== undefined ? data.mealRelation : m.mealRelation,
              reminderEnabled:
                data.reminderEnabled !== undefined ? data.reminderEnabled : m.reminderEnabled,
              imageUrl: getMedicationImage(data.name?.trim() ?? m.name),
            };
            result = next;
            return next;
          })
        );
        if (!result) throw new Error('Este medicamento ya no está disponible.');
        return result;
      }

      const payload = formToApiPayload(data);
      const saved = attachCatalogImage(
        await apiUpdateMedication(id, {
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          ...(payload.dose !== undefined ? { dose: payload.dose } : {}),
          ...(data.frequency !== undefined ? { frequency: payload.frequency } : {}),
          ...(data.quantity !== undefined ? { amount: payload.amount ?? null } : {}),
          ...(data.unitsPerIntake !== undefined
            ? { unitsPerIntake: payload.unitsPerIntake ?? null }
            : {}),
          ...(data.startDate !== undefined ? { startDate: payload.startDate } : {}),
          ...(data.endDate !== undefined ? { endDate: payload.endDate } : {}),
          ...(data.description !== undefined ? { instructions: payload.instructions } : {}),
          ...(data.presentation !== undefined ? { presentation: payload.presentation ?? null } : {}),
          ...(data.doseAmount !== undefined ? { doseAmount: payload.doseAmount ?? null } : {}),
          ...(data.doseUnit !== undefined ? { doseUnit: payload.doseUnit ?? null } : {}),
          ...(data.purpose !== undefined ? { purpose: payload.purpose ?? null } : {}),
          ...(data.weekdays !== undefined ? { weekdays: payload.weekdays ?? null } : {}),
          ...(data.mealRelation !== undefined
            ? { mealRelation: payload.mealRelation ?? null }
            : {}),
          ...(data.reminderEnabled !== undefined
            ? { reminderEnabled: payload.reminderEnabled }
            : {}),
          ...(data.schedules !== undefined ? { schedules: payload.schedules } : {}),
        })
      );

      setMedications((prev) => prev.map((m) => (m.id === id ? saved : m)));
      void syncMedicationNotifications(
        medications.map((m) => (m.id === id ? saved : m)),
        { isDemo: false }
      );
      return saved;
    },
    [user, isDemo, medications]
  );

  const removeMedication = useCallback(
    async (id: string) => {
      if (!user) {
        throw new Error('Debes iniciar sesión para eliminar medicamentos.');
      }

      if (isDemo) {
        setMedications((prev) => prev.filter((m) => m.id !== id));
        return;
      }

      await apiDeleteMedication(id);
      const next = medications.filter((m) => m.id !== id);
      setMedications(next);
      void syncMedicationNotifications(next, { isDemo: false });
    },
    [user, isDemo, medications]
  );

  return (
    <MedicationContext.Provider
      value={{
        medications,
        loading,
        loadMedications,
        refreshMedications,
        addMedication,
        updateMedication,
        removeMedication,
      }}
    >
      {children}
    </MedicationContext.Provider>
  );
}

export function useMedications() {
  const context = useContext(MedicationContext);
  if (!context) throw new Error('useMedications debe usarse dentro de MedicationProvider');
  return context;
}

export { MedicationApiError };
