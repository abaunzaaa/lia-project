/**
 * Tipos del módulo de referencia farmacológica (RxNorm / openFDA / DailyMed).
 * Independiente del CRUD personal de medicamentos.
 */

export interface DrugSearchResult {
  id: string;
  name: string;
  displayName: string;
  tty: string | null;
  source: 'rxnorm';
  score: number | null;
}

export interface DrugInfoSource {
  name: 'openFDA' | 'DailyMed' | 'RxNorm';
  reference: string | null;
}

export interface DrugInfo {
  id: string;
  name: string;
  genericName: string | null;
  brandNames: string[];
  summary: string | null;
  uses: string[];
  warnings: string[];
  precautions: string[];
  dosageForms: string[];
  informationAvailable: boolean;
  source: DrugInfoSource;
  disclaimer: string;
}

/** Ficha orientada al paciente (español sencillo). */
export interface PatientDrugInfo {
  id: string | null;
  name: string;
  genericName: string | null;
  brandNames: string[];
  purpose: string | null;
  importantInformation: string[];
  precautions: string[];
  dosageForms: string[];
  source: DrugInfoSource | null;
  language: 'es';
  simplified: boolean;
  informationAvailable: boolean;
  disclaimer: string;
}

export const DRUG_INFO_DISCLAIMER =
  'Esta información es orientativa y no reemplaza las indicaciones de tu profesional de salud.';

/** Fragmento de fuente enviado a la IA (ya recortado). */
export interface DrugSourcePayload {
  name: string;
  genericName: string | null;
  uses: string[];
  warnings: string[];
  precautions: string[];
  summary: string | null;
}
/** Respuestas parciales de RxNorm (approximateTerm). */
export interface RxNormApproximateCandidate {
  rxcui?: string;
  rxaui?: string;
  score?: string;
  rank?: string;
  name?: string;
  source?: string;
}

export interface RxNormApproximateResponse {
  approximateGroup?: {
    candidate?: RxNormApproximateCandidate | RxNormApproximateCandidate[];
  };
}

export interface RxNormPropertiesResponse {
  properties?: {
    rxcui?: string;
    name?: string;
    synonym?: string;
    tty?: string;
    language?: string;
    suppress?: string;
  };
}

export interface RxNormRelatedResponse {
  relatedGroup?: {
    conceptGroup?: Array<{
      tty?: string;
      conceptProperties?: Array<{
        rxcui?: string;
        name?: string;
        tty?: string;
      }>;
    }>;
  };
}

/** openFDA Drug Label (campos usados). */
export interface OpenFdaLabelOpenFda {
  generic_name?: string[];
  brand_name?: string[];
  rxcui?: string[];
  dosage_form?: string[];
  spl_set_id?: string[];
}

export interface OpenFdaLabelResult {
  set_id?: string;
  id?: string;
  purpose?: string[];
  indications_and_usage?: string[];
  description?: string[];
  warnings?: string[];
  warnings_and_cautions?: string[];
  do_not_use?: string[];
  ask_doctor?: string[];
  ask_doctor_or_pharmacist?: string[];
  stop_use?: string[];
  pregnancy_or_breast_feeding?: string[];
  precautions?: string[];
  dosage_and_administration?: string[];
  openfda?: OpenFdaLabelOpenFda;
}

export interface OpenFdaLabelResponse {
  results?: OpenFdaLabelResult[];
  error?: {
    code?: string;
    message?: string;
  };
}

export interface DailyMedSplListItem {
  setid?: string;
  title?: string;
  published_date?: string;
}

export interface DailyMedSplListResponse {
  data?: DailyMedSplListItem[];
}
