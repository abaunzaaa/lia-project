-- Additive: units per intake (1–5 tablets/units per scheduled dose)
ALTER TABLE public.medications
  ADD COLUMN IF NOT EXISTS units_per_intake integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'medications_units_per_intake_range'
  ) THEN
    ALTER TABLE public.medications
      ADD CONSTRAINT medications_units_per_intake_range
      CHECK (units_per_intake >= 1 AND units_per_intake <= 5);
  END IF;
END $$;
