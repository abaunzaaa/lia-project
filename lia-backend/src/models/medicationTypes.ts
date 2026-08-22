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
  schedules?: string[];
}

export type Medication = MedicationResponse;
