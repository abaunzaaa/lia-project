import { Request, Response } from 'express';
import { aiService, AiProviderError } from '../services/aiService';
import { findMedication } from '../models/medicationDatabase';
import { getDrugInfo, DrugReferenceError } from '../services/drugReferenceService';
import { PatientDrugInfo } from '../models/drugReferenceTypes';
import { markLatestWaitingSessionRecognized } from '../services/cameraSessionService';
import { RecognitionResult } from '../models/types';

function buildVoiceText(name: string, patient: PatientDrugInfo | null): string {
  const purpose =
    patient?.purpose?.trim() ||
    'Es un medicamento. Sigue siempre las indicaciones de tu médico o farmacéutico.';

  const extra =
    patient?.importantInformation?.[0]?.trim() ||
    'Si tienes dudas, consulta a un profesional de la salud.';

  return `${name}. ${purpose} ${extra}`.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function extractDeviceId(req: Request): string | undefined {
  const raw = req.headers['x-device-id'];
  if (Array.isArray(raw)) {
    const first = raw[0]?.trim();
    return first || undefined;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed || undefined;
  }
  return undefined;
}

/**
 * POST /api/medications/recognize
 * Reconocimiento de medicamento vía imagen (App móvil + ESP32-CAM)
 */
export async function recognizeMedication(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Imagen requerida' });
    }

    const deviceId = extractDeviceId(req);
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[camera-recognition] deviceId=${deviceId ?? '(missing)'} bytes=${req.file.buffer.length}`
      );
    }

    const vision = await aiService.recognizeFromImage(req.file.buffer, deviceId);

    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[camera-recognition] recognizedName=${vision.name || '(empty)'} identified=${vision.identified}`
      );
    }

    let patientInfo: PatientDrugInfo | null = null;
    let rxcui: string | null = null;
    let description = 'No se pudo obtener información adicional del medicamento.';
    let dose = '';

    // Enriquecer ficha si hay nombre; el fallo de Drug Reference NO bloquea la sesión.
    if (vision.name) {
      try {
        patientInfo = await getDrugInfo({ name: vision.name });
        rxcui = patientInfo.id;
        description =
          patientInfo.purpose ||
          patientInfo.importantInformation[0] ||
          description;
        dose = patientInfo.dosageForms[0] || '';
      } catch (error) {
        if (!(error instanceof DrugReferenceError)) {
          console.error(
            '[recognize:drug-reference]',
            error instanceof Error ? error.message : 'error'
          );
        }
        const catalog = findMedication(vision.name);
        if (catalog) {
          description = catalog.description;
          dose = catalog.dose;
        }
      }
    }

    const identified = Boolean(vision.identified && vision.name);
    const voiceText = identified ? buildVoiceText(vision.name, patientInfo) : null;

    const payload: RecognitionResult = {
      name: vision.name || '',
      description,
      dose,
      confidence: vision.confidence,
      rxcui,
      patientInfo,
      voiceText,
      identified,
    };

    // Completar sesión waiting con EL MISMO resultado (una foto → un reconocimiento).
    // No exigir patientInfo/rxcui: basta con el nombre.
    if (!deviceId) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          '[camera-session:match] deviceId=(missing) found=false — ESP32 debe enviar X-Device-Id'
        );
      }
    } else if (identified && vision.name) {
      try {
        const sessionId = await markLatestWaitingSessionRecognized({
          deviceId,
          medicationName: vision.name,
          rxcui,
          patientInfo,
          voiceText,
        });
        if (process.env.NODE_ENV !== 'production') {
          if (sessionId) {
            console.log(
              `[camera-session:match] deviceId=${deviceId} sessionId=${sessionId} found=true`
            );
            console.log(
              `[camera-session:complete] sessionId=${sessionId} status=recognized`
            );
          } else {
            console.warn(
              `[camera-session:match] deviceId=${deviceId} sessionId=(none) found=false`
            );
          }
        }
      } catch (error) {
        console.error(
          '[camera-session:complete:error]',
          error instanceof Error ? error.message : 'error'
        );
      }
    }

    return res.json(payload);
  } catch (error) {
    if (error instanceof AiProviderError) {
      if (error.kind === 'not_configured') {
        return res.status(503).json({
          error: 'IA no configurada',
          message: error.message,
        });
      }
      if (error.kind === 'timeout') {
        return res.status(504).json({
          error: 'Timeout',
          message: 'El reconocimiento tardó demasiado. Inténtalo de nuevo.',
        });
      }
      return res.status(502).json({
        error: 'Error de reconocimiento',
        message: 'No se pudo procesar la imagen con el proveedor de IA.',
      });
    }

    console.error('Error en reconocimiento:', error);
    return res.status(500).json({ error: 'Error al procesar la imagen' });
  }
}

/**
 * POST /api/medications/chat
 * Chat con LIA sobre un medicamento
 */
export async function chatWithLIA(req: Request, res: Response) {
  try {
    const { medicationName, question } = req.body;

    if (!medicationName || !question) {
      return res.status(400).json({ error: 'medicationName y question son requeridos' });
    }

    const answer = await aiService.chat(medicationName, question);
    return res.json({ answer });
  } catch (error) {
    console.error('Error en chat:', error);
    return res.status(500).json({ error: 'Error al procesar la consulta' });
  }
}

/**
 * GET /api/medications/info
 * Información de un medicamento por nombre
 */
export async function getMedicationInfo(req: Request, res: Response) {
  try {
    const name = req.query.name as string;
    if (!name) {
      return res.status(400).json({ error: 'Parámetro name requerido' });
    }

    const med = findMedication(name);
    if (!med) {
      return res.status(404).json({ error: 'Medicamento no encontrado' });
    }

    return res.json({
      name: med.name,
      description: med.description,
      dose: med.dose,
      category: med.category,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error al buscar medicamento' });
  }
}

/**
 * GET /api/health
 * Health check
 */
export function healthCheck(_req: Request, res: Response) {
  res.json({
    status: 'ok',
    service: 'LIA Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
}
