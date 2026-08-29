/**
 * Base URL del backend LIA.
 * Preferir EXPO_PUBLIC_API_URL (definida en .env).
 * En dispositivo físico usar la IP LAN del PC (no 127.0.0.1 ni 192.168.1.5 de emulador).
 */
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  'http://192.168.1.8:3000/api'
).replace(/\/$/, '');