-- Additive: campos del flujo Agregar medicamento (presentación, dosis estructurada,
-- propósito, días de la semana, relación con comida, recordatorio por medicamento).
-- No borra ni reinicia datos. weekdays NULL = todos los días (medicamentos anteriores).

ALTER TABLE public.medications
  ADD COLUMN IF NOT EXISTS presentation text,
  ADD COLUMN IF NOT EXISTS dose_amount numeric,
  ADD COLUMN IF NOT EXISTS dose_unit text,
  ADD COLUMN IF NOT EXISTS purpose text,
  ADD COLUMN IF NOT EXISTS weekdays text[],
  ADD COLUMN IF NOT EXISTS meal_relation text,
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'medications_presentation_allowed'
  ) THEN
    ALTER TABLE public.medications
      ADD CONSTRAINT medications_presentation_allowed
      CHECK (
        presentation IS NULL
        OR presentation IN ('tablet', 'capsule', 'liquid', 'drops', 'sachet')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'medications_meal_relation_allowed'
  ) THEN
    ALTER TABLE public.medications
      ADD CONSTRAINT medications_meal_relation_allowed
      CHECK (
        meal_relation IS NULL
        OR meal_relation IN ('before_meal', 'after_meal', 'with_meal')
      );
  END IF;
END $$;
