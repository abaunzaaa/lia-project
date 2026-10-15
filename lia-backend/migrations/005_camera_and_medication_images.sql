-- Additive: foto capturada por la ESP32-CAM en la sesión y en el medicamento.

ALTER TABLE public.camera_recognition_sessions
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.medications
  ADD COLUMN IF NOT EXISTS image_url text;
