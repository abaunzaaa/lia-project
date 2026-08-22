-- Additive: camera recognition sessions (ESP32 ↔ mobile polling)
CREATE TABLE IF NOT EXISTS public.camera_recognition_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  device_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('waiting', 'recognized', 'expired')),
  medication_name text,
  rxcui text,
  patient_info jsonb,
  voice_text text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_camera_sessions_device_status
  ON public.camera_recognition_sessions (device_id, status);

CREATE INDEX IF NOT EXISTS idx_camera_sessions_user_id
  ON public.camera_recognition_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_camera_sessions_expires_at
  ON public.camera_recognition_sessions (expires_at);
