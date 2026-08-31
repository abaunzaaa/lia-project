-- Oculta una ocurrencia de dosis del historial sin borrar el medicamento ni sus horarios.

CREATE TABLE IF NOT EXISTS public.medication_history_hides (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  schedule_id uuid NOT NULL REFERENCES public.medication_schedules(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, medication_id, schedule_id, scheduled_for)
);

CREATE INDEX IF NOT EXISTS medication_history_hides_user_idx
  ON public.medication_history_hides (user_id);
