import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JwtPayload } from '../models/userTypes';

export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
    email: string;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'No autorizado. Token requerido.',
    });
  }

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'No autorizado. Formato de token inválido.',
    });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No autorizado. Token requerido.',
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload & JwtPayload;

    if (!decoded.sub || !decoded.email) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado. Token inválido.',
      });
    }

    req.auth = {
      userId: decoded.sub,
      email: decoded.email,
    };

    return next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado. Token expirado.',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'No autorizado. Token inválido.',
    });
  }
}
