-- Permitir sesiones de cámara sin usuario (modo invitado / sin cuenta).
ALTER TABLE public.camera_recognition_sessions
  ALTER COLUMN user_id DROP NOT NULL;
