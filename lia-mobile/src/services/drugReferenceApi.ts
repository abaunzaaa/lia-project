import { API_BASE_URL } from '../config/api';
import { getAuthToken } from './authApi';
import { ApiClientError, friendlyApiMessage } from './apiClient';
import { PatientDrugInfo, DrugSearchResult } from '../types';
import { presentDrugName } from '../utils/drugReferenceLabels';

const SEARCH_MIN_CHARS = 2;

type ApiSuccessList = {
  success: boolean;
  data?: DrugSearchResult[];
  message?: string;
};

type ApiSuccessInfo = {
  success: boolean;
  data?: PatientDrugInfo;
  message?: string;
};

async function drugHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  const token = await getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function readErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { message?: string };
    return body?.message;
  } catch {
    return undefined;
  }
}

function mapDrugHttpError(status: number, raw: string | undefined): ApiClientError {
  if (status === 502 || status === 504) {
    return new ApiClientError(
      'No pudimos consultar la información en este momento. Inténtalo nuevamente.',
      status
    );
  }
  if (status === 400 && raw) {
    return new ApiClientError(raw, status);
  }
  return new ApiClientError(friendlyApiMessage(status, raw, false), status);
}

async function drugRequest(path: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: await drugHeaders(),
    });
  } catch {
    throw new ApiClientError(friendlyApiMessage(undefined, undefined, true), undefined);
  }

  if (!response.ok) {
    const raw = await readErrorMessage(response);
    throw mapDrugHttpError(response.status, raw);
  }

  return response;
}

function mapSearchItem(raw: DrugSearchResult): DrugSearchResult {
  const name = presentDrugName(raw.name) || raw.name || '';
  const displayName = presentDrugName(raw.displayName || raw.name) || name;
  return {
    id: String(raw.id ?? ''),
    name,
    displayName,
    tty: raw.tty ?? null,
    source: raw.source || 'rxnorm',
    score: raw.score ?? null,
  };
}

/** Mapea la respuesta PatientDrugInfo del backend (sin campos crudos EN). */
function mapPatientDrugInfo(raw: PatientDrugInfo): PatientDrugInfo {
  return {
    id: raw.id ?? null,
    name: presentDrugName(raw.name) || raw.name || '',
    genericName: presentDrugName(raw.genericName) ?? raw.genericName ?? null,
    brandNames: Array.isArray(raw.brandNames)
      ? raw.brandNames.map((item) => presentDrugName(item) || item)
      : [],
    purpose: raw.purpose ?? null,
    importantInformation: Array.isArray(raw.importantInformation)
      ? raw.importantInformation
      : [],
    precautions: Array.isArray(raw.precautions) ? raw.precautions : [],
    dosageForms: Array.isArray(raw.dosageForms) ? raw.dosageForms : [],
    source: raw.source
      ? {
          name: raw.source.name,
          reference: raw.source.reference ?? null,
        }
      : null,
    language: 'es',
    simplified: Boolean(raw.simplified),
    informationAvailable: Boolean(raw.informationAvailable),
    disclaimer:
      raw.disclaimer?.trim() ||
      'Esta información es orientativa y no reemplaza las indicaciones de tu profesional de salud.',
  };
}

/**
 * GET /api/drug-reference/search?q=&limit=
 * Mínimo de búsqueda alineado con el backend: 2 caracteres.
 */
export async function searchDrugs(
  query: string,
  limit = 10
): Promise<DrugSearchResult[]> {
  const q = query.trim();
  if (q.length < SEARCH_MIN_CHARS) {
    throw new ApiClientError('Escribe al menos 2 caracteres.', 400);
  }

  const qs = new URLSearchParams({
    q,
    limit: String(Math.min(Math.max(limit, 1), 20)),
  });

  const response = await drugRequest(`/drug-reference/search?${qs.toString()}`);
  const body = (await response.json()) as ApiSuccessList;
  const list = Array.isArray(body.data) ? body.data : [];
  return list.map(mapSearchItem).filter((item) => item.id && item.displayName);
}

/**
 * GET /api/drug-reference/info?rxcui=
 * Devuelve PatientDrugInfo (español simplificado).
 */
export async function getDrugInfoByRxcui(rxcui: string): Promise<PatientDrugInfo> {
  const id = rxcui.trim();
  if (!id) {
    throw new ApiClientError('No pudimos abrir la ficha de este medicamento.', 400);
  }

  const qs = new URLSearchParams({ rxcui: id });
  const response = await drugRequest(`/drug-reference/info?${qs.toString()}`);
  const body = (await response.json()) as ApiSuccessInfo;
  if (!body.data) {
    throw new ApiClientError(
      'No pudimos consultar la información en este momento. Inténtalo nuevamente.',
      502
    );
  }
  return mapPatientDrugInfo(body.data);
}

/**
 * GET /api/drug-reference/info?name=
 */
export async function getDrugInfoByName(name: string): Promise<PatientDrugInfo> {
  const q = name.trim();
  if (q.length < SEARCH_MIN_CHARS) {
    throw new ApiClientError('Escribe al menos 2 caracteres.', 400);
  }

  const qs = new URLSearchParams({ name: q });
  const response = await drugRequest(`/drug-reference/info?${qs.toString()}`);
  const body = (await response.json()) as ApiSuccessInfo;
  if (!body.data) {
    throw new ApiClientError(
      'No pudimos consultar la información en este momento. Inténtalo nuevamente.',
      502
    );
  }
  return mapPatientDrugInfo(body.data);
}

export { SEARCH_MIN_CHARS };
export { ApiClientError as DrugReferenceApiError };
