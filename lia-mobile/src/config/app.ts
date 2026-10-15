import { Platform } from 'react-native';
import { API_BASE_URL } from './api';

/**
 * Configuración general de LIA
 */
export const APP_CONFIG = {
  /** Cámara desactivada — se activará en versión futura */
  CAMERA_ENABLED: false,
  /** ESP32-CAM desactivado por ahora */
  ESP32_ENABLED: false,
};

/**
 * Aviso de cámara solo en el cliente web desplegado (API en Vercel).
 * EXPO_PUBLIC_CAMERA_NOTICE=1 fuerza el aviso; =0 lo oculta.
 * Expo Go / web local contra LAN no lo muestran.
 */
export function shouldShowOnlineCameraNotice(): boolean {
  const flag = (process.env.EXPO_PUBLIC_CAMERA_NOTICE || '').trim().toLowerCase();
  if (flag === '0' || flag === 'false') return false;
  if (flag === '1' || flag === 'true') return true;
  if (Platform.OS !== 'web') return false;
  try {
    return new URL(API_BASE_URL).hostname.toLowerCase().endsWith('.vercel.app');
  } catch {
    return false;
  }
}
