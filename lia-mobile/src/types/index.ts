export interface User {
  uid: string;
  fullName: string;
  email: string;
  age: number;
  emergencyContact: string;
  /** Alergias declaradas por el usuario. Solo registro; LIA no diagnostica ni infiere tratamientos. */
  allergies?: string[];
  photoURL?: string;
  createdAt: string;
}

/** Horario de toma (backend: schedules[].time en HH:mm). */
export interface MedicationSchedule {
  id: string;
  time: string;
}

export type MedicationPresentation =
  | 'tablet'
  | 'capsule'
  | 'liquid'
  | 'drops'
  | 'sachet';

export type MealRelation = 'before_meal' | 'after_meal' | 'with_meal';

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

/**
 * Modelo UI de medicamento.
 * quantity ↔ amount (stock), unitsPerIntake ↔ unidades por toma, description ↔ instructions.
 */
export interface Medication {
  id: string;
  userId: string;
  name: string;
  dose: string;
  quantity: number;
  /** Unidades que se toman cada vez (p. ej. 2 tabletas). */
  unitsPerIntake?: number;
  frequency: string;
  /** Primer horario HH:mm (compatibilidad con pantallas existentes). */
  time: string;
  schedules: MedicationSchedule[];
  startDate: string;
  endDate?: string;
  description?: string;
  presentation?: MedicationPresentation | null;
  doseAmount?: number | null;
  doseUnit?: string | null;
  purpose?: string;
  weekdays?: Weekday[] | null;
  mealRelation?: MealRelation | null;
  reminderEnabled?: boolean;
  /** URL de imagen del medicamento (backend/API). */
  imageUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

/** Datos de formulario para crear/actualizar (sin id/ownership). */
export type MedicationFormData = {
  name: string;
  dose: string;
  quantity?: number;
  unitsPerIntake?: number;
  frequency?: string;
  /** Horarios HH:mm (uno o varios). */
  schedules: string[];
  startDate?: string;
  endDate?: string;
  description?: string;
  imageUrl?: string;
  presentation?: MedicationPresentation | null;
  doseAmount?: number;
  doseUnit?: string;
  purpose?: string;
  weekdays?: Weekday[];
  mealRelation?: MealRelation | null;
  reminderEnabled?: boolean;
};

export type DoseStatus = 'pending' | 'taken' | 'skipped' | 'missed';

export interface Reminder {
  id: string;
  medicationId: string;
  scheduleId: string;
  medicationName: string;
  dose: string;
  /** HH:mm */
  scheduledTime: string;
  date: string;
  /** ISO datetime del backend */
  scheduledFor: string;
  status: DoseStatus;
  intakeId: string | null;
  actionAt: string | null;
  /** Solo demo local */
  userId?: string;
}

export interface HistoryEntry {
  id: string;
  medicationId: string;
  scheduleId: string;
  medicationName: string;
  dose: string;
  date: string;
  time: string;
  scheduledFor: string;
  status: DoseStatus;
  actionAt: string | null;
  /** ID de `medication_intakes` cuando la toma ya fue tomada u omitida. */
  intakeId: string | null;
}

/** @deprecated Prefer HistoryEntry — alias de compatibilidad. */
export type MedicationHistory = HistoryEntry;

export interface AdherenceSummary {
  totalScheduled: number;
  taken: number;
  skipped: number;
  missed: number;
  percentage: number | null;
}

/** Insights determinísticos de historial (GET /history/insights). */
export type HistoryTimeOfDayPeriod = 'morning' | 'afternoon' | 'evening';

export interface HistoryInsightsSummary {
  totalDue: number;
  taken: number;
  skipped: number;
  missed: number;
  adherencePercentage: number | null;
}

export interface HistoryInsightsDaily extends HistoryInsightsSummary {
  date: string;
}

export interface HistoryInsightsMedication extends HistoryInsightsSummary {
  medicationId: string;
  name: string;
}

export interface HistoryInsightsTimeOfDay extends HistoryInsightsSummary {
  period: HistoryTimeOfDayPeriod;
}

export interface HistoryInsightsData {
  range: {
    from: string;
    to: string;
    timezone: string;
  };
  summary: HistoryInsightsSummary;
  daily: HistoryInsightsDaily[];
  byMedication: HistoryInsightsMedication[];
  byTimeOfDay: HistoryInsightsTimeOfDay[];
  insights: string[];
}

/** Un medicamento dentro del próximo horario de toma. */
export interface NextDoseItem {
  reminderId: string;
  medicationName: string;
  dose: string;
}

/**
 * Próximo horario de toma (puede incluir varios medicamentos a la misma hora).
 * Solo incluye reminders pending con scheduledFor > ahora.
 */
export interface NextDoseGroup {
  /** HH:mm */
  time: string;
  date: string;
  scheduledFor: string;
  items: NextDoseItem[];
}

/** @deprecated Prefer NextDoseGroup — alias de compatibilidad. */
export type NextDose = NextDoseGroup;

export interface RecognitionResult {
  name: string;
  description: string;
  dose: string;
  confidence: number;
}

/** Resultado de búsqueda RxNorm (referencia farmacológica). */
export interface DrugSearchResult {
  id: string;
  name: string;
  displayName: string;
  tty?: string | null;
  source: string;
  score?: number | null;
}

export interface DrugInfoSource {
  name: string;
  reference?: string | null;
}

/**
 * Ficha orientada al paciente (español sencillo).
 * Contrato real: GET /api/drug-reference/info → PatientDrugInfo
 */
export interface PatientDrugInfo {
  id: string | null;
  name: string;
  genericName: string | null;
  brandNames: string[];
  purpose: string | null;
  importantInformation: string[];
  precautions: string[];
  dosageForms: string[];
  source: DrugInfoSource | null;
  language: 'es';
  simplified: boolean;
  informationAvailable: boolean;
  disclaimer: string;
}

/** @deprecated Prefer PatientDrugInfo */
export type DrugInfo = PatientDrugInfo;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export type MainTabParamList = {
  Home: undefined;
  Medications: undefined;
  Reminders: undefined;
  History: undefined;
  Profile: undefined;
};

export type HistoryStackParamList = {
  HistoryHome: undefined;
  HistoryCalendar: undefined;
  HistoryAnalysis: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Main:
    | {
        screen?: keyof MainTabParamList;
        params?: undefined;
      }
    | undefined;
  ScanMedication: undefined;
  CameraGuide: undefined;
  DrugSearch: { fresh?: boolean } | undefined;
  DrugMatches: {
    query: string;
    results: DrugSearchResult[];
    error?: string;
  };
  DrugInfo: { rxcui: string; displayName?: string };
  RecognitionResult: { result: RecognitionResult; imageUri?: string };
  AddMedication: { prefilled?: Partial<Medication> };
  EditMedication: { medication: Medication };
  MedicationDetail: { medication: Medication };
  /** Chat farmacológico grounded (POST /drug-reference/chat). */
  DrugChat: {
    name: string;
    rxcui?: string;
    registeredDose?: string;
  };
  Settings: undefined;
  EmergencyContact: undefined;
};
