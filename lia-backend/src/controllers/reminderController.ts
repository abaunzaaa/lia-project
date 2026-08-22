import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthenticatedRequest } from '../middleware/requireAuth';
import { reminderQuerySchema, formatZodError } from '../models/intakeSchemas';
import { getRemindersForDay } from '../services/reminderService';
import { DoseServiceError } from '../services/scheduledDoseService';

export async function listReminders(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'No autorizado. Token requerido.' });
    }

    const query = reminderQuerySchema.parse({
      date: req.query.date,
      timezone: req.query.timezone,
    });

    const reminders = await getRemindersForDay({
      userId,
      date: query.date,
      timezone: query.timezone,
    });

    return res.status(200).json({
      success: true,
      data: reminders,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, message: formatZodError(error) });
    }
    if (error instanceof DoseServiceError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('[reminders:list]', error instanceof Error ? error.message : 'Error desconocido');
    return res.status(500).json({
      success: false,
      message: 'Error interno al obtener recordatorios.',
    });
  }
}
