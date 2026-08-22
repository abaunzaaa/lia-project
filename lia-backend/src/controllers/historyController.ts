import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthenticatedRequest } from '../middleware/requireAuth';
import {
  historyQuerySchema,
  adherenceQuerySchema,
  historyInsightsQuerySchema,
  formatZodError,
} from '../models/intakeSchemas';
import { getHistory } from '../services/historyService';
import { getAdherence } from '../services/adherenceService';
import { getHistoryInsights } from '../services/historyInsightsService';
import { DoseServiceError } from '../services/scheduledDoseService';

export async function listHistory(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'No autorizado. Token requerido.' });
    }

    const query = historyQuerySchema.parse({
      from: req.query.from,
      to: req.query.to,
      timezone: req.query.timezone,
    });

    const history = await getHistory({
      userId,
      from: query.from,
      to: query.to,
      timezone: query.timezone,
    });

    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, message: formatZodError(error) });
    }
    if (error instanceof DoseServiceError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('[history:list]', error instanceof Error ? error.message : 'Error desconocido');
    return res.status(500).json({
      success: false,
      message: 'Error interno al obtener el historial.',
    });
  }
}

export async function getAdherenceSummary(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'No autorizado. Token requerido.' });
    }

    const query = adherenceQuerySchema.parse({
      from: req.query.from,
      to: req.query.to,
      timezone: req.query.timezone,
    });

    const adherence = await getAdherence({
      userId,
      from: query.from,
      to: query.to,
      timezone: query.timezone,
    });

    return res.status(200).json({
      success: true,
      data: adherence,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, message: formatZodError(error) });
    }
    if (error instanceof DoseServiceError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('[adherence:get]', error instanceof Error ? error.message : 'Error desconocido');
    return res.status(500).json({
      success: false,
      message: 'Error interno al calcular la adherencia.',
    });
  }
}

export async function getHistoryInsightsSummary(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'No autorizado. Token requerido.' });
    }

    const query = historyInsightsQuerySchema.parse({
      from: req.query.from,
      to: req.query.to,
      timezone: req.query.timezone,
    });

    const insights = await getHistoryInsights({
      userId,
      from: query.from,
      to: query.to,
      timezone: query.timezone,
    });

    return res.status(200).json({
      success: true,
      data: insights,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, message: formatZodError(error) });
    }
    if (error instanceof DoseServiceError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('[history:insights]', error instanceof Error ? error.message : 'Error desconocido');
    return res.status(500).json({
      success: false,
      message: 'Error interno al calcular las estadísticas del historial.',
    });
  }
}
