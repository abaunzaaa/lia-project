import { Request, Response } from 'express';
import { ZodError } from 'zod';
import {
  registerSchema,
  loginSchema,
  formatZodError,
  registerZodErrorCode,
} from '../models/authSchemas';
import * as authService from '../services/authService';
import { AuthServiceError } from '../services/authService';
import { AuthenticatedRequest } from '../middleware/requireAuth';

function logAuthError(context: string, error: unknown) {
  if (error instanceof Error) {
    console.error(`[auth:${context}]`, error.message);
  } else {
    console.error(`[auth:${context}]`, 'Error desconocido');
  }
}

export async function register(req: Request, res: Response) {
  try {
    const parsed = registerSchema.parse(req.body);
    const result = await authService.register(parsed);

    return res.status(201).json({
      success: true,
      message: 'Cuenta creada correctamente.',
      data: {
        user: result.user,
        token: result.token,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const code = registerZodErrorCode(error);
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[register] status=400 reason=${code}`);
      }
      return res.status(400).json({
        success: false,
        message: formatZodError(error),
        code,
      });
    }

    if (error instanceof AuthServiceError) {
      const code = error.statusCode === 409 ? 'email_exists' : 'auth_error';
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[register] status=${error.statusCode} reason=${code}`);
      }
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code,
      });
    }

    logAuthError('register', error);
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[register] status=500 reason=server_error');
    }
    return res.status(500).json({
      success: false,
      message: 'No pudimos crear la cuenta en este momento. Inténtalo nuevamente.',
      code: 'server_error',
    });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const parsed = loginSchema.parse(req.body);
    const result = await authService.login(parsed);

    return res.status(200).json({
      success: true,
      message: 'Inicio de sesión correcto.',
      data: {
        user: result.user,
        token: result.token,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: formatZodError(error),
      });
    }

    if (error instanceof AuthServiceError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    logAuthError('login', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al iniciar sesión.',
    });
  }
}

export async function me(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado. Token requerido.',
      });
    }

    const user = await authService.getUserById(userId);

    return res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    logAuthError('me', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al obtener el perfil.',
    });
  }
}
