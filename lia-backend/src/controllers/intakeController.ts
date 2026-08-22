import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthenticatedRequest } from '../middleware/requireAuth';
import { createIntakeSchema, formatZodError } from '../models/intakeSchemas';
import { upsertIntake } from '../services/intakeService';
import { DoseServiceError } from '../services/scheduledDoseService';

export async function createOrUpdateIntake(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'No autorizado. Token requerido.' });
    }

    const parsed = createIntakeSchema.parse(req.body);
    const intake = await upsertIntake({
      userId,
      medicationId: parsed.medicationId,
      scheduleId: parsed.scheduleId,
      date: parsed.date,
      timezone: parsed.timezone,
      status: parsed.status,
    });

    return res.status(200).json({
      success: true,
      message:
        parsed.status === 'taken'
          ? 'Toma registrada correctamente.'
          : 'Omitido registrado correctamente.',
      data: { intake },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, message: formatZodError(error) });
    }
    if (error instanceof DoseServiceError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('[intakes:create]', error instanceof Error ? error.message : 'Error desconocido');
    return res.status(500).json({
      success: false,
      message: 'Error interno al registrar la toma.',
    });
  }
}
