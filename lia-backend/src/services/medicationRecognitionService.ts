import { aiService } from './aiService';
import { findMedication } from '../models/medicationDatabase';
import { getDrugInfo, getRawDrugInfo, DrugReferenceError } from './drugReferenceService';
import { medicationSourceAgrees } from './drugChatService';
import { PatientDrugInfo } from '../models/drugReferenceTypes';
import { RecognitionResult } from '../models/types';
import { getBrandNames, searchApproximateTerms } from './rxNormService';

/**
 * Ficha oficial solo si el nombre leído coincide con el concepto o su marca.
 * Un parecido de RxNorm no descarga la monografía de otro medicamento.
 */
async function referenceForSameDrug(name: string) {
  const rough = await searchApproximateTerms(name, 1);
  const top = rough[0];
  if (!top) return null;
  const brandNames = await getBrandNames(top.id);
  if (
    !medicationSourceAgrees(name, {
      name: top.name,
      genericName: top.name,
      brandNames,
    })
  ) {
    return null;
  }
  return getRawDrugInfo({ rxcui: top.id, name });
}

function agreedCatalog(name: string): { description: string; dose: string } | null {
  const catalog = findMedication(name);
  if (!catalog) return null;
  const agrees = medicationSourceAgrees(name, {
    name: catalog.name,
    genericName: catalog.name,
    brandNames: catalog.aliases,
  });
  if (!agrees) return null;
  return { description: catalog.description, dose: catalog.dose };
}

function buildVoiceText(name: string, patient: PatientDrugInfo | null): string {
  const purpose =
    patient?.purpose?.trim() ||
    'Es un medicamento. Sigue siempre las indicaciones de tu médico o farmacéutico.';

  const extra =
    patient?.importantInformation?.[0]?.trim() ||
    'Si tienes dudas, consulta a un profesional de la salud.';

  return `${name}. ${purpose} ${extra}`.replace(/\s+/g, ' ').trim().slice(0, 500);
}

/**
 * Misma identificación y el mismo enriquecimiento que usa la cámara física
 * cuando la imagen llega a POST /api/medications/recognize.
 * No crea prompts, no elige modelo y no toca sesiones de dispositivo.
 */
export async function recognizeAndEnrichMedicationImage(
  imageBuffer: Buffer,
  deviceId?: string
): Promise<RecognitionResult> {
  const vision = await aiService.recognizeFromImage(imageBuffer, deviceId);

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
      const raw = await referenceForSameDrug(vision.name);
      const sameDrug = Boolean(
        raw && medicationSourceAgrees(vision.name, raw) && raw.informationAvailable
      );
      if (raw && sameDrug) {
        patientInfo = await getDrugInfo({ rxcui: raw.id, name: vision.name });
        rxcui = patientInfo.id;
        description =
          patientInfo.purpose ||
          patientInfo.importantInformation[0] ||
          description;
        dose = patientInfo.dosageForms[0] || '';
      } else if (!raw) {
        const local = agreedCatalog(vision.name);
        if (local) {
          description = local.description;
          dose = local.dose;
        }
      }
    } catch (error) {
      if (!(error instanceof DrugReferenceError)) {
        console.error(
          '[recognize:drug-reference]',
          error instanceof Error ? error.message : 'error'
        );
      }
      const local = agreedCatalog(vision.name);
      if (local) {
        description = local.description;
        dose = local.dose;
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

  return payload;
}
