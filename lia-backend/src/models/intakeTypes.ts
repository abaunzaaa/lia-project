export type IntakeStatus = 'taken' | 'skipped';

/** Estados derivados (pending/missed no se persisten en BD). */
export type DerivedDoseStatus = 'pending' | 'taken' | 'skipped' | 'missed';

export interface MedicationBrief {
  name: string;
  dose: string;
}

export interface ReminderItem {
  id: string;
  medicationId: string;
  scheduleId: string;
  medication: MedicationBrief;
  date: string;
  time: string;
  scheduledFor: string;
  status: DerivedDoseStatus;
  intakeId: string | null;
  actionAt: string | null;
}

export interface IntakeResponse {
  id: string;
  medicationId: string;
  scheduleId: string | null;
  scheduledFor: string;
  status: IntakeStatus;
  actionAt: string;
}

export interface HistoryItem {
  medicationId: string;
  scheduleId: string;
  intakeId: string | null;
  medication: MedicationBrief;
  date: string;
  time: string;
  scheduledFor: string;
  status: DerivedDoseStatus;
  actionAt: string | null;
}

export interface AdherenceSummary {
  totalScheduled: number;
  taken: number;
  skipped: number;
  missed: number;
  percentage: number | null;
}

/** Fila interna de dosis programada + intake opcional. */
export interface ScheduledDoseRow {
  medication_id: string;
  schedule_id: string;
  medication_name: string;
  medication_dose: string;
  dose_date: string;
  time_hm: string;
  scheduled_for: Date;
  intake_id: string | null;
  intake_status: IntakeStatus | null;
  action_at: Date | null;
}
