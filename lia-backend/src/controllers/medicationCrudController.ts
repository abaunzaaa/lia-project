import { Response } from 'express';
import { ZodError } from 'zod';
import {
  createMedicationSchema,
  updateMedicationSchema,
  formatZodError,
} from '../models/medicationSchemas';
import * as medicationService from '../services/medicationService';
import { MedicationServiceError } from '../services/medicationService';
import { AuthenticatedRequest } from '../middleware/requireAuth';

function getUserId(req: AuthenticatedRequest): string | null {
  return req.auth?.userId ?? null;
}

function logError(context: string, error: unknown) {
  if (error instanceof Error) {
    console.error(`[medications:${context}]`, error.message);
  } else {
    console.error(`[medications:${context}]`, 'Error desconocido');
  }
}

export async function listMedications(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'No autorizado. Token requerido.' });
    }

    const medications = await medicationService.listMedications(userId);
    return res.status(200).json({
      success: true,
      data: medications,
    });
  } catch (error) {
    if (error instanceof MedicationServiceError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    logError('list', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al listar medicamentos.',
    });
  }
}

export async function createMedication(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'No autorizado. Token requerido.' });
    }

    const parsed = createMedicationSchema.parse(req.body);
    const { userId: _ignored, ...input } = parsed;
    const medication = await medicationService.createMedication(userId, input);

    return res.status(201).json({
      success: true,
      message: 'Medicamento creado correctamente.',
      data: { medication },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, message: formatZodError(error) });
    }
    if (error instanceof MedicationServiceError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    logError('create', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al crear el medicamento.',
    });
  }
}

export async function getMedication(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'No autorizado. Token requerido.' });
    }

    const medication = await medicationService.getMedicationById(userId, req.params.id);
    return res.status(200).json({
      success: true,
      data: { medication },
    });
  } catch (error) {
    if (error instanceof MedicationServiceError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    logError('get', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al obtener el medicamento.',
    });
  }
}

export async function updateMedication(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'No autorizado. Token requerido.' });
    }

    const parsed = updateMedicationSchema.parse(req.body);
    const { userId: _ignored, ...input } = parsed;
    const medication = await medicationService.updateMedication(userId, req.params.id, input);

    return res.status(200).json({
      success: true,
      message: 'Medicamento actualizado correctamente.',
      data: { medication },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, message: formatZodError(error) });
    }
    if (error instanceof MedicationServiceError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    logError('update', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al actualizar el medicamento.',
    });
  }
}

export async function deleteMedication(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'No autorizado. Token requerido.' });
    }

    await medicationService.deleteMedication(userId, req.params.id);
    return res.status(200).json({
      success: true,
      message: 'Medicamento eliminado correctamente.',
    });
  } catch (error) {
    if (error instanceof MedicationServiceError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    logError('delete', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al eliminar el medicamento.',
    });
  }
}
