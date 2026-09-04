import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/api';
import { User } from '../types';

const AUTH_TOKEN_KEY = 'lia_auth_token';

export type RegisterPayload = {
  fullName: string;
  age: number;
  email: string;
  password: string;
  emergencyContact: string;
};

type BackendUser = {
  id: string;
  fullName: string;
  age: number;
  email: string;
  emergencyContact: string | null;
  createdAt: string;
};

type AuthSuccessBody = {
  success: boolean;
  message?: string;
  data?: {
    user: BackendUser;
    token: string;
  };
};

type MeSuccessBody = {
  success: boolean;
  message?: string;
  data?: {
    user: BackendUser;
  };
};

type AuthErrorBody = {
  success?: boolean;
  message?: string;
  code?: string;
};

export class AuthApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

/** Mapea el usuario del backend al modelo local (uid = id). */
export function mapBackendUser(apiUser: BackendUser): User {
  return {
    uid: apiUser.id,
    fullName: apiUser.fullName,
    email: apiUser.email,
    age: apiUser.age,
    emergencyContact: apiUser.emergencyContact ?? '',
    createdAt: apiUser.createdAt,
  };
}

export async function getAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function saveAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

export async function clearAuthToken(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}

function looksTechnical(message: string): boolean {
  return /zod|postgres|sql|stack|ECONNREFUSED|DATABASE_URL|JWT|password_hash/i.test(
    message
  );
}

function mapRegisterError(status: number | undefined, raw?: string, code?: string): string {
  if (status === 409 || code === 'email_exists') {
    return 'Ya existe una cuenta con este correo.';
  }

  const lower = (raw || '').toLowerCase();

  if (
    status === 400 &&
    (code === 'invalid_phone' ||
      lower.includes('teléfono') ||
      lower.includes('telefono') ||
      lower.includes('contacto de emergencia'))
  ) {
    return 'Ingresa un número de teléfono completo.';
  }

  if (
    status === 400 &&
    (code === 'invalid_password' || lower.includes('contraseña'))
  ) {
    return 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un carácter especial.';
  }

  if (status === 400) {
    if (raw && !looksTechnical(raw)) return raw;
    return 'Revisa los datos ingresados.';
  }

  if (status === 500 || status === 502 || status === 503) {
    return 'No pudimos crear la cuenta en este momento. Inténtalo nuevamente.';
  }

  if (raw && !looksTechnical(raw)) return raw;
  return 'No pudimos crear la cuenta en este momento. Inténtalo nuevamente.';
}

async function readErrorBody(
  response: Response
): Promise<{ message?: string; code?: string }> {
  try {
    const body = (await response.json()) as AuthErrorBody;
    return { message: body?.message, code: body?.code };
  } catch {
    return {};
  }
}

/**
 * POST /auth/register → { user, token }
 */
export async function registerWithApi(
  payload: RegisterPayload
): Promise<{ user: User; token: string }> {
  const body = {
    fullName: payload.fullName.trim(),
    age: Number(payload.age),
    email: payload.email.trim().toLowerCase(),
    password: payload.password,
    emergencyContact: payload.emergencyContact.trim(),
  };

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    if (__DEV__) {
      console.warn('[register] request failed network');
    }
    throw new AuthApiError(
      'No pudimos conectarnos con LIA. Revisa tu conexión.',
      undefined,
      'network'
    );
  }

  if (!response.ok) {
    const err = await readErrorBody(response);
    if (__DEV__) {
      console.warn(
        `[register] request failed status=${response.status}` +
          (err.code ? ` code=${err.code}` : '')
      );
    }
    throw new AuthApiError(
      mapRegisterError(response.status, err.message, err.code),
      response.status,
      err.code
    );
  }

  const successBody = (await response.json()) as AuthSuccessBody;
  if (!successBody.data?.user || !successBody.data?.token) {
    throw new AuthApiError(
      'No pudimos crear la cuenta en este momento. Inténtalo nuevamente.'
    );
  }

  return {
    user: mapBackendUser(successBody.data.user),
    token: successBody.data.token,
  };
}

/**
 * POST /auth/login → { user, token }
 */
export async function loginWithApi(
  email: string,
  password: string
): Promise<{ user: User; token: string }> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
      }),
    });
  } catch {
    throw new AuthApiError(
      'No pudimos conectarnos con LIA. Revisa tu conexión.',
      undefined,
      'network'
    );
  }

  if (!response.ok) {
    const err = await readErrorBody(response);
    const msg =
      response.status === 401
        ? 'Correo o contraseña incorrectos.'
        : err.message && !looksTechnical(err.message)
          ? err.message
          : 'No pudimos completar la solicitud. Inténtalo de nuevo.';
    throw new AuthApiError(msg, response.status, err.code);
  }

  const successBody = (await response.json()) as AuthSuccessBody;
  if (!successBody.data?.user || !successBody.data?.token) {
    throw new AuthApiError('Respuesta de inicio de sesión incompleta.');
  }

  return {
    user: mapBackendUser(successBody.data.user),
    token: successBody.data.token,
  };
}

/**
 * GET /auth/me con Bearer token
 */
export async function fetchMe(token: string): Promise<User> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new AuthApiError(
      'No pudimos conectarnos con LIA. Revisa tu conexión.',
      undefined,
      'network'
    );
  }

  if (!response.ok) {
    const err = await readErrorBody(response);
    throw new AuthApiError(
      err.message && !looksTechnical(err.message)
        ? err.message
        : 'No pudimos completar la solicitud. Inténtalo de nuevo.',
      response.status,
      err.code
    );
  }

  const successBody = (await response.json()) as MeSuccessBody;
  if (!successBody.data?.user) {
    throw new AuthApiError('Respuesta de perfil incompleta.');
  }

  return mapBackendUser(successBody.data.user);
}

/**
 * PATCH /auth/me → { user }
 */
export async function updateEmergencyContactWithApi(emergencyContact: string): Promise<User> {
  const token = await getAuthToken();
  if (!token) {
    throw new AuthApiError('Tu sesión expiró. Vuelve a iniciar sesión.', 401);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ emergencyContact }),
    });
  } catch {
    throw new AuthApiError(
      'No pudimos conectarnos con LIA. Revisa tu conexión.',
      undefined,
      'network'
    );
  }

  if (!response.ok) {
    const err = await readErrorBody(response);
    throw new AuthApiError(
      err.message && !looksTechnical(err.message)
        ? err.message
        : 'No pudimos guardar el contacto. Inténtalo nuevamente.',
      response.status,
      err.code
    );
  }

  const successBody = (await response.json()) as MeSuccessBody;
  if (!successBody.data?.user) {
    throw new AuthApiError('No pudimos guardar el contacto. Inténtalo nuevamente.');
  }

  return mapBackendUser(successBody.data.user);
}
