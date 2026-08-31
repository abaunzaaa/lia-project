/** Fila de public.medications (snake_case PostgreSQL). */
export interface DbMedication {
  id: string;
  user_id: string;
  name: string;
  dose: string;
  frequency: string | null;
  amount: number | null;
  units_per_intake: number;
  start_date: string | null;
  end_date: string | null;
  instructions: string | null;
  presentation: string | null;
  dose_amount: string | number | null;
  dose_unit: string | null;
  purpose: string | null;
  weekdays: string[] | null;
  meal_relation: string | null;
  reminder_enabled: boolean;
  is_active: boolean;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date | null;
}

/** Fila de public.medication_schedules. */
export interface DbMedicationSchedule {
  id: string;
  medication_id: string;
  time_of_day: string;
  created_at: Date;
}

export interface MedicationSchedule {
  id: string;
  time: string;
}

export type MedicationPresentation = 'tablet' | 'capsule' | 'liquid' | 'drops' | 'sachet';
export type MealRelation = 'before_meal' | 'after_meal' | 'with_meal';
export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

/** Respuesta de medicamento para la API (camelCase, sin user_id). */
export interface MedicationResponse {
  id: string;
  name: string;
  dose: string;
  frequency: string | null;
  amount: number | null;
  unitsPerIntake: number;
  startDate: string | null;
  endDate: string | null;
  instructions: string | null;
  presentation: MedicationPresentation | null;
  doseAmount: number | null;
  doseUnit: string | null;
  purpose: string | null;
  weekdays: Weekday[] | null;
  mealRelation: MealRelation | null;
  reminderEnabled: boolean;
  schedules: MedicationSchedule[];
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateMedicationInput {
  name: string;
  dose: string;
  frequency?: string | null;
  amount?: number | null;
  unitsPerIntake?: number;
  startDate?: string | null;
  endDate?: string | null;
  instructions?: string | null;
  presentation?: MedicationPresentation | null;
  doseAmount?: number | null;
  doseUnit?: string | null;
  purpose?: string | null;
  weekdays?: Weekday[] | null;
  mealRelation?: MealRelation | null;
  reminderEnabled?: boolean;
  schedules?: string[];
}

export interface UpdateMedicationInput {
  name?: string;
  dose?: string;
  frequency?: string | null;
  amount?: number | null;
  unitsPerIntake?: number;
  startDate?: string | null;
  endDate?: string | null;
  instructions?: string | null;
  presentation?: MedicationPresentation | null;
  doseAmount?: number | null;
  doseUnit?: string | null;
  purpose?: string | null;
  weekdays?: Weekday[] | null;
  mealRelation?: MealRelation | null;
  reminderEnabled?: boolean;
  schedules?: string[];
}

export type Medication = MedicationResponse;
