import { aiService, AiProviderError } from './aiService';
import { findMedication } from '../models/medicationDatabase';
import { getDrugInfo, getRawDrugInfo, DrugReferenceError } from './drugReferenceService';
import { DrugChatError, lookupPublicProduct, medicationSourceAgrees } from './drugChatService';
import {
  describeCommercialProduct,
  lookupCommercialCatalog,
} from './commercialCatalogService';
import { DRUG_INFO_DISCLAIMER, PatientDrugInfo } from '../models/drugReferenceTypes';
import { RecognitionResult } from '../models/types';
import { explainMobileRecognition } from './compositionRecognitionService';
import { distinctiveNameTokens } from './packageObservation';
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

function patientFromPurpose(name: string, purpose: string, dosageForms: string[] = []): PatientDrugInfo {
  return {
    id: null,
    name,
    genericName: null,
    brandNames: [],
    purpose,
    importantInformation: [],
    precautions: [],
    dosageForms,
    source: null,
    language: 'es',
    simplified: true,
    informationAvailable: true,
    disclaimer: DRUG_INFO_DISCLAIMER,
  };
}

export async function enrichRecognizedName(
  name: string,
  options?: { requireDistinctiveToken?: boolean }
): Promise<{
  patientInfo: PatientDrugInfo | null;
  rxcui: string | null;
  description: string;
  dose: string;
}> {
  let patientInfo: PatientDrugInfo | null = null;
  let rxcui: string | null = null;
  let description = 'No se pudo obtener información adicional del medicamento.';
  let dose = '';

  try {
    const raw = await referenceForSameDrug(name);
    const sameDrug = Boolean(
      raw && medicationSourceAgrees(name, raw) && raw.informationAvailable
    );
    if (raw && sameDrug) {
      patientInfo = await getDrugInfo({ rxcui: raw.id, name });
      const distinctive = !options?.requireDistinctiveToken || phoneNameAgrees(name, patientInfo);
      rxcui = patientInfo.id;
      const purpose = patientInfo.purpose?.trim() || patientInfo.importantInformation[0]?.trim() || '';
      if (purpose && distinctive) {
        description = purpose;
        dose = patientInfo.dosageForms[0] || '';
        return { patientInfo, rxcui, description, dose };
      }
      if (!distinctive) {
        patientInfo = null;
        rxcui = null;
      }
    }
  } catch (error) {
    if (!(error instanceof DrugReferenceError)) {
      console.error('[recognize:drug-reference]', error instanceof Error ? error.message : 'error');
    }
  }

  const listed = await lookupCommercialCatalog(name);
  if (listed) {
    description = describeCommercialProduct(listed);
    dose = listed.form || '';
    patientInfo = patientFromPurpose(name, description, listed.form ? [listed.form] : []);
    logEnrichment(name, {
      presentation: listed.form,
      product: listed.name,
      source: listed.source,
      agreed: true,
      reason: 'mismo nombre comercial',
      purpose: description,
    });
    return { patientInfo, rxcui, description, dose };
  }

  const local = agreedCatalog(name);
  if (local) {
    description = local.description;
    patientInfo = patientFromPurpose(name, local.description);
    logEnrichment(name, {
      presentation: null,
      product: name,
      source: 'catálogo local',
      agreed: true,
      reason: 'nombre del catálogo',
      purpose: description,
    });
    return { patientInfo, rxcui, description, dose };
  }

  try {
    const commercial = await lookupPublicProduct(name);
    const purpose = commercial?.uses[0]?.trim() || '';
    if (commercial && purpose && medicationSourceAgrees(name, commercial)) {
      description = purpose;
      patientInfo = patientFromPurpose(name, purpose, commercial.dosageForms);
      patientInfo.importantInformation = commercial.warnings.slice(0, 3);
      logEnrichment(name, {
        presentation: commercial.dosageForms[0] || null,
        product: commercial.name,
        source: 'búsqueda pública',
        agreed: true,
        reason: 'el nombre del resultado coincide',
        purpose: description,
      });
    } else {
      logEnrichment(name, {
        presentation: null,
        product: commercial?.name || null,
        source: commercial ? 'búsqueda pública' : 'ninguna',
        agreed: false,
        reason: commercial ? 'el nombre no coincide' : 'sin ficha ni catálogo comercial',
        purpose: null,
      });
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      const http =
        error instanceof AiProviderError
          ? error.httpStatus ?? 'none'
          : error instanceof DrugChatError
            ? error.statusCode
            : 'none';
      const category = error instanceof AiProviderError ? error.quota ?? error.kind : 'error';
      console.warn(`[recognize:public] http=${http} category=${category}`);
    }
  }

  return { patientInfo, rxcui, description, dose };
}

function logEnrichment(
  name: string,
  stage: {
    presentation: string | null;
    product: string | null;
    source: string;
    agreed: boolean;
    reason: string;
    purpose: string | null;
  }
): void {
  if (process.env.NODE_ENV === 'production') return;
  console.log(
    `[recognize:stages] read=${name} normalized=${name.trim().toLowerCase()} presentation=${stage.presentation || '-'} packageText=none product=${stage.product || '-'} ingredient=- source=${stage.source} agreed=${stage.agreed} reason=${stage.reason} purpose=${stage.purpose ? 'yes' : 'no'} patientPurpose=${stage.purpose ? 'yes' : 'no'}`
  );
}

function phoneNameAgrees(name: string, info: PatientDrugInfo): boolean {
  const tokens = distinctiveNameTokens(name);
  if (tokens.length === 0) return false;
  return tokens.some((token) =>
    medicationSourceAgrees(token, {
      name: info.name,
      genericName: info.genericName,
      brandNames: info.brandNames,
    })
  );
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
  deviceId?: string,
  options?: { readPackage?: boolean }
): Promise<RecognitionResult> {
  const vision = await aiService.recognizeFromImage(imageBuffer, deviceId, {
    readPackage: options?.readPackage === true,
  });
  if (options?.readPackage) {
    return explainMobileRecognition(vision);
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[camera-recognition] recognizedName=${vision.name || '(empty)'} identified=${vision.identified}`
    );
  }

  let patientInfo: PatientDrugInfo | null = null;
  let rxcui: string | null = null;
  let description = 'No se pudo obtener información adicional del medicamento.';
  let dose = '';

  if (vision.name) {
    const enriched = await enrichRecognizedName(vision.name);
    patientInfo = enriched.patientInfo;
    rxcui = enriched.rxcui;
    description = enriched.description;
    dose = enriched.dose;
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
