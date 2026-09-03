import {
  DRUG_INFO_DISCLAIMER,
  DrugInfo,
  DrugSearchResult,
  OpenFdaLabelResult,
  PatientDrugInfo,
} from '../models/drugReferenceTypes';
import {
  drugReferenceCache,
  INFO_CACHE_TTL_MS,
  SEARCH_CACHE_TTL_MS,
} from '../utils/memoryCache';
import {
  ExternalApiError,
  cleanStringList,
  titleCaseName,
  truncateText,
} from '../utils/externalHttp';
import * as rxNorm from './rxNormService';
import * as openFda from './openFdaService';
import * as dailyMed from './dailyMedService';
import { simplifyDrugInfoForPatient } from './drugInformationSimplifierService';

export class DrugReferenceError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'DrugReferenceError';
  }
}

function mapExternalError(error: unknown, fallbackMessage: string): never {
  if (error instanceof DrugReferenceError) throw error;

  if (error instanceof ExternalApiError) {
    if (error.kind === 'timeout') {
      throw new DrugReferenceError(
        504,
        'El servicio de medicamentos tarda demasiado. Inténtalo de nuevo en unos momentos.'
      );
    }
    throw new DrugReferenceError(502, fallbackMessage);
  }

  console.error('[drug-reference]', error instanceof Error ? error.message : 'Error desconocido');
  throw new DrugReferenceError(502, fallbackMessage);
}

export async function searchDrugs(query: string, limit: number): Promise<DrugSearchResult[]> {
  const cacheKey = `search:${query.toLowerCase()}:${limit}`;
  const cached = drugReferenceCache.get<DrugSearchResult[]>(cacheKey);
  if (cached) {
    if ((process.env.NODE_ENV || 'development') !== 'production') {
      console.log('[drug-reference] search cache hit');
    }
    return cached;
  }

  try {
    const results = await rxNorm.searchApproximateTerms(query, limit);
    drugReferenceCache.set(cacheKey, results, SEARCH_CACHE_TTL_MS);
    return results;
  } catch (error) {
    mapExternalError(
      error,
      'No pudimos buscar medicamentos en este momento. Inténtalo más tarde.'
    );
  }
}

function buildSummary(label: OpenFdaLabelResult): string | null {
  const purpose = label.purpose?.[0];
  const indications = label.indications_and_usage?.[0];
  const description = label.description?.[0];
  const raw = purpose || indications || description;
  if (!raw) return null;
  return truncateText(raw, 500);
}

function mapLabelToDrugInfo(params: {
  rxcui: string;
  name: string;
  brandNames: string[];
  label: OpenFdaLabelResult;
  sourceName: 'openFDA' | 'DailyMed';
}): DrugInfo {
  const { rxcui, name, brandNames, label, sourceName } = params;
  const openfda = label.openfda;

  const genericFromLabel = openfda?.generic_name?.[0]
    ? titleCaseName(openfda.generic_name[0])
    : null;

  const brandsFromLabel = (openfda?.brand_name ?? []).map(titleCaseName);
  const mergedBrands = cleanStringList([...brandNames, ...brandsFromLabel], {
    maxItems: 12,
    maxCharsPerItem: 80,
  });

  const uses = cleanStringList(
    [...(label.purpose ?? []), ...(label.indications_and_usage ?? [])],
    { maxItems: 4, maxCharsPerItem: 700 }
  );

  const warnings = cleanStringList(
    [
      ...(label.warnings ?? []),
      ...(label.warnings_and_cautions ?? []),
      ...(label.do_not_use ?? []),
      ...(label.stop_use ?? []),
    ],
    { maxItems: 6, maxCharsPerItem: 700 }
  );

  const precautions = cleanStringList(
    [
      ...(label.precautions ?? []),
      ...(label.ask_doctor ?? []),
      ...(label.ask_doctor_or_pharmacist ?? []),
      ...(label.pregnancy_or_breast_feeding ?? []),
    ],
    { maxItems: 6, maxCharsPerItem: 700 }
  );

  const dosageAndAdministration = cleanStringList(label.dosage_and_administration ?? [], {
    maxItems: 4,
    maxCharsPerItem: 700,
  });
  const whenUsing = cleanStringList(label.when_using ?? [], {
    maxItems: 4,
    maxCharsPerItem: 500,
  });
  const storage = cleanStringList(
    [...(label.storage_and_handling ?? []), ...(label.other_information ?? [])],
    { maxItems: 3, maxCharsPerItem: 400 }
  );
  const interactions = cleanStringList(label.drug_interactions ?? [], {
    maxItems: 4,
    maxCharsPerItem: 700,
  });

  const dosageForms = cleanStringList(openfda?.dosage_form ?? [], {
    maxItems: 8,
    maxCharsPerItem: 80,
  });

  const setId = label.set_id || openfda?.spl_set_id?.[0] || null;
  const summary = buildSummary(label);

  return {
    id: rxcui,
    name: titleCaseName(name),
    genericName: genericFromLabel || titleCaseName(name),
    brandNames: mergedBrands,
    summary,
    uses,
    warnings,
    precautions,
    dosageAndAdministration,
    whenUsing,
    storage,
    interactions,
    dosageForms,
    informationAvailable: Boolean(
      uses.length ||
        warnings.length ||
        precautions.length ||
        dosageAndAdministration.length ||
        whenUsing.length ||
        interactions.length ||
        summary
    ),
    source: {
      name: sourceName,
      reference: setId,
    },
    disclaimer: DRUG_INFO_DISCLAIMER,
  };
}

function emptyInfo(params: {
  rxcui: string;
  name: string;
  brandNames: string[];
}): DrugInfo {
  return {
    id: params.rxcui,
    name: titleCaseName(params.name),
    genericName: titleCaseName(params.name),
    brandNames: params.brandNames,
    summary: null,
    uses: [],
    warnings: [],
    precautions: [],
    dosageAndAdministration: [],
    whenUsing: [],
    storage: [],
    interactions: [],
    dosageForms: [],
    informationAvailable: false,
    source: {
      name: 'RxNorm',
      reference: params.rxcui,
    },
    disclaimer: DRUG_INFO_DISCLAIMER,
  };
}

function labelHasUsableContent(label: OpenFdaLabelResult): boolean {
  return Boolean(
    label.purpose?.[0] ||
      label.indications_and_usage?.[0] ||
      label.description?.[0] ||
      label.warnings?.[0] ||
      label.warnings_and_cautions?.[0] ||
      label.dosage_and_administration?.[0]
  );
}

function isLikelyComboLabel(label: OpenFdaLabelResult, ingredientName: string): boolean {
  const generic = (label.openfda?.generic_name?.[0] || '').toLowerCase();
  const ingredient = ingredientName.toLowerCase();
  if (!generic || !ingredient) return false;
  return generic.includes(' and ') && !ingredient.includes(' and ') && generic.includes(ingredient);
}

async function resolveLabel(
  rxcui: string,
  name: string,
  brandNames: string[]
): Promise<{ label: OpenFdaLabelResult; sourceName: 'openFDA' | 'DailyMed' } | null> {
  const usable: Array<{ label: OpenFdaLabelResult; sourceName: 'openFDA' | 'DailyMed' }> = [];

  const consider = (
    label: OpenFdaLabelResult | null,
    sourceName: 'openFDA' | 'DailyMed'
  ): { label: OpenFdaLabelResult; sourceName: 'openFDA' | 'DailyMed' } | null => {
    if (!label || !labelHasUsableContent(label)) return null;
    usable.push({ label, sourceName });
    if (!isLikelyComboLabel(label, name)) {
      return { label, sourceName };
    }
    return null;
  };

  try {
    const preferred = consider(await openFda.findLabelByRxcui(rxcui), 'openFDA');
    if (preferred) return preferred;
  } catch (error) {
    if (!(error instanceof ExternalApiError && error.kind === 'timeout')) {
      console.error('[openFDA:rxcui]', error instanceof Error ? error.message : 'error');
    } else {
      throw error;
    }
  }

  try {
    const preferred = consider(await openFda.findLabelBySubstanceName(name), 'openFDA');
    if (preferred) return preferred;
  } catch (error) {
    if (error instanceof ExternalApiError && error.kind === 'timeout') throw error;
  }

  try {
    const preferred = consider(await openFda.findLabelByGenericName(name), 'openFDA');
    if (preferred) return preferred;
  } catch (error) {
    if (error instanceof ExternalApiError && error.kind === 'timeout') throw error;
  }

  for (const brand of brandNames.slice(0, 6)) {
    try {
      const preferred = consider(await openFda.findLabelByBrandName(brand), 'openFDA');
      if (preferred) return preferred;
    } catch (error) {
      if (error instanceof ExternalApiError && error.kind === 'timeout') throw error;
    }
  }

  try {
    let setIds = await dailyMed.findSplSetIdsByRxcui(rxcui, 3);
    if (setIds.length === 0) {
      setIds = await dailyMed.findSplSetIdsByDrugName(name, 3);
    }

    for (const setId of setIds) {
      const preferred = consider(await openFda.findLabelBySetId(setId), 'DailyMed');
      if (preferred) return preferred;
    }
  } catch (error) {
    if (error instanceof ExternalApiError && error.kind === 'timeout') throw error;
    console.error('[dailyMed:fallback]', error instanceof Error ? error.message : 'error');
  }

  return usable[0] ?? null;
}

async function fetchRawDrugInfo(params: {
  rxcui?: string;
  name?: string;
}): Promise<DrugInfo> {
  const rawCacheKey = `info-raw:${params.rxcui ?? ''}:${(params.name ?? '').toLowerCase()}`;
  const cachedRaw = drugReferenceCache.get<DrugInfo>(rawCacheKey);
  if (cachedRaw) return cachedRaw;

  let rxcui = params.rxcui?.trim();
  let name = params.name?.trim();

  if (!rxcui && name) {
    rxcui = (await rxNorm.findRxcuiByName(name)) ?? undefined;
  }

  if (!rxcui) {
    throw new DrugReferenceError(
      404,
      'No encontramos ese medicamento en el catálogo de referencia.'
    );
  }

  const props = await rxNorm.getConceptProperties(rxcui);
  if (!props) {
    throw new DrugReferenceError(
      404,
      'No encontramos ese medicamento en el catálogo de referencia.'
    );
  }

  name = props.name;
  const brandNames = await rxNorm.getBrandNames(rxcui);
  const resolved = await resolveLabel(rxcui, name, brandNames);

  const info = resolved
    ? mapLabelToDrugInfo({
        rxcui,
        name,
        brandNames,
        label: resolved.label,
        sourceName: resolved.sourceName,
      })
    : emptyInfo({ rxcui, name, brandNames });

  drugReferenceCache.set(rawCacheKey, info, INFO_CACHE_TTL_MS);
  return info;
}

/** Ficha cruda de fuentes oficiales, independiente de la simplificación para el paciente. */
export async function getRawDrugInfo(params: {
  rxcui?: string;
  name?: string;
}): Promise<DrugInfo> {
  return fetchRawDrugInfo(params);
}

/**
 * Ficha para el paciente: fuente farmacológica + simplificación ES.
 * Cachea la versión final (no solo el label crudo).
 */
export async function getDrugInfo(params: {
  rxcui?: string;
  name?: string;
}): Promise<PatientDrugInfo> {
  const cacheKey = `patient-info:es:${params.rxcui ?? ''}:${(params.name ?? '').toLowerCase()}`;
  const cached = drugReferenceCache.get<PatientDrugInfo>(cacheKey);
  if (cached) {
    if ((process.env.NODE_ENV || 'development') !== 'production') {
      console.log('[drug-reference] patient-info cache hit');
    }
    return cached;
  }

  try {
    const raw = await fetchRawDrugInfo(params);
    if ((process.env.NODE_ENV || 'development') !== 'production') {
      console.log(
        '[drug-reference] source=',
        raw.source.name,
        'available=',
        raw.informationAvailable
      );
    }

    const patient = await simplifyDrugInfoForPatient(raw);

    // No cachear fallos de IA por largo tiempo: permite reintento cuando Gemini responda.
    if (patient.simplified || !patient.informationAvailable) {
      drugReferenceCache.set(cacheKey, patient, INFO_CACHE_TTL_MS);
    } else {
      drugReferenceCache.set(cacheKey, patient, 60 * 1000);
    }
    return patient;
  } catch (error) {
    if (error instanceof DrugReferenceError) throw error;
    mapExternalError(
      error,
      'No pudimos obtener la información del medicamento. Inténtalo más tarde.'
    );
  }
}
