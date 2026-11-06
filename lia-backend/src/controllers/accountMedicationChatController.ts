import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthenticatedRequest } from '../middleware/requireAuth';
import {
  accountChatRequestSchema,
  formatAccountChatZodError,
} from '../models/accountChatSchemas';
import { chatAboutRegisteredMedications } from '../services/accountMedicationChatService';
import { DrugChatError } from '../services/drugChatService';

export async function chatAboutAccountMedications(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado. Token requerido.',
      });
    }

    const parsed = accountChatRequestSchema.parse(req.body);
    const result = await chatAboutRegisteredMedications({ userId, input: parsed });

    return res.status(200).json({
      success: true,
      data: {
        message: result.message,
        medication: { id: null, name: 'tus medicamentos' },
        source: { name: result.sourceName, reference: null },
        grounded: true,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, message: formatAccountChatZodError(error) });
    }
    if (error instanceof DrugChatError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('[account-chat]', error instanceof Error ? error.message : 'error');
    return res.status(500).json({
      success: false,
      message: 'Error interno al procesar la conversación.',
    });
  }
}
