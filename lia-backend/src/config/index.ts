import dotenv from 'dotenv';

dotenv.config();

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL no está definida. Agrégala a tu archivo .env con la cadena de conexión de Supabase.'
    );
  }

  return databaseUrl;
}

function getJwtSecret(): string {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error(
      'JWT_SECRET no está definida. Agrégala a tu archivo .env para usar autenticación real.'
    );
  }

  return jwtSecret;
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  /** Solo se evalúa al acceder; no bloquea el arranque de Express si falta. */
  get databaseUrl(): string {
    return getDatabaseUrl();
  },
  /** Solo se evalúa al firmar/verificar JWT. */
  get jwtSecret(): string {
    return getJwtSecret();
  },
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  ai: {
    serviceUrl: process.env.AI_SERVICE_URL,
    apiKey: process.env.AI_API_KEY,
    /** Fallback genérico (compatibilidad). */
    model: process.env.AI_MODEL || 'gemini-3.6-flash',
    /** Simplificación de fichas farmacológicas (PatientDrugInfo). */
    simplificationModel:
      process.env.AI_SIMPLIFICATION_MODEL ||
      process.env.AI_MODEL ||
      'gemini-3.5-flash-lite',
    /** Chat “Preguntar a LÍA”. */
    chatModel:
      process.env.AI_CHAT_MODEL || process.env.AI_MODEL || 'gemini-3.6-flash',
    timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '30000', 10),
  },
  openFda: {
    /** Opcional: aumenta límites de cuota openFDA. */
    apiKey: process.env.OPENFDA_API_KEY || undefined,
  },
  /** Token opcional para ESP32. Si está vacío, no se exige X-Device-Token. */
  esp32DeviceToken: process.env.ESP32_DEVICE_TOKEN || undefined,
};
