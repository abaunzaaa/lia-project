import { Response } from 'express';
import { ZodError } from 'zod';
import {
  drugSearchQuerySchema,
  drugInfoQuerySchema,
  formatZodError as formatDrugRefZodError,
} from '../models/drugReferenceSchemas';
import {
  drugChatRequestSchema,
  formatZodError as formatChatZodError,
} from '../models/drugChatSchemas';
import * as drugReferenceService from '../services/drugReferenceService';
import { DrugReferenceError } from '../services/drugReferenceService';
import { chatAboutDrug, DrugChatError } from '../services/drugChatService';

export async function searchDrugs(req: import('express').Request, res: Response) {
  try {
    const query = drugSearchQuerySchema.parse({
      q: req.query.q,
      limit: req.query.limit,
    });

    const results = await drugReferenceService.searchDrugs(query.q, query.limit);

    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, message: formatDrugRefZodError(error) });
    }
    if (error instanceof DrugReferenceError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('[drug-reference:search]', error instanceof Error ? error.message : 'error');
    return res.status(500).json({
      success: false,
      message: 'Error interno al buscar medicamentos.',
    });
  }
}

export async function getDrugInfo(req: import('express').Request, res: Response) {
  try {
    const query = drugInfoQuerySchema.parse({
      rxcui: req.query.rxcui,
      name: req.query.name,
    });

    const info = await drugReferenceService.getDrugInfo({
      rxcui: query.rxcui,
      name: query.name,
    });

    return res.status(200).json({
      success: true,
      data: info,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, message: formatDrugRefZodError(error) });
    }
    if (error instanceof DrugReferenceError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('[drug-reference:info]', error instanceof Error ? error.message : 'error');
    return res.status(500).json({
      success: false,
      message: 'Error interno al obtener la información del medicamento.',
    });
  }
}

export async function chatAboutMedication(req: import('express').Request, res: Response) {
  try {
    const parsed = drugChatRequestSchema.parse(req.body);
    const data = await chatAboutDrug(parsed);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, message: formatChatZodError(error) });
    }
    if (error instanceof DrugChatError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('[drug-reference:chat]', error instanceof Error ? error.message : 'error');
    return res.status(500).json({
      success: false,
      message: 'Error interno al procesar la conversación.',
    });
  }
}
