import { config } from '../config';
import { OpenFdaLabelResponse, OpenFdaLabelResult } from '../models/drugReferenceTypes';
import { ExternalApiError, fetchJson, foldAccents } from '../utils/externalHttp';

const OPENFDA_LABEL = 'https://api.fda.gov/drug/label.json';

function withApiKey(url: string): string {
  const key = config.openFda.apiKey;
  if (!key) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}api_key=${encodeURIComponent(key)}`;
}

async function searchLabel(searchExpr: string): Promise<OpenFdaLabelResult | null> {
  const url = withApiKey(
    `${OPENFDA_LABEL}?search=${encodeURIComponent(searchExpr)}&limit=1`
  );

  try {
    const data = await fetchJson<OpenFdaLabelResponse>(url, { timeoutMs: 9000 });
    if (data.error?.code === 'NOT_FOUND') return null;
    return data.results?.[0] ?? null;
  } catch (error) {
    if (error instanceof ExternalApiError && error.kind === 'not_found') {
      return null;
    }
    // openFDA a veces responde 404 JSON; fetchJson ya mapea 404.
    // Otros errores se propagan.
    throw error;
  }
}

export async function findLabelByGenericName(name: string): Promise<OpenFdaLabelResult | null> {
  const folded = foldAccents(name).trim();
  if (!folded) return null;

  // Frases con espacios requieren comillas en openFDA
  const quoted = `"${folded.replace(/"/g, '')}"`;
  return searchLabel(`openfda.generic_name:${quoted}`);
}

export async function findLabelBySubstanceName(name: string): Promise<OpenFdaLabelResult | null> {
  const folded = foldAccents(name).trim();
  if (!folded) return null;
  const quoted = `"${folded.replace(/"/g, '')}"`;
  return searchLabel(`openfda.substance_name:${quoted}`);
}

export async function findLabelByBrandName(name: string): Promise<OpenFdaLabelResult | null> {
  const folded = foldAccents(name).trim();
  if (!folded) return null;
  const quoted = `"${folded.replace(/"/g, '')}"`;
  return searchLabel(`openfda.brand_name:${quoted}`);
}

export async function findLabelBySetId(setId: string): Promise<OpenFdaLabelResult | null> {
  const clean = setId.trim();
  if (!clean) return null;
  return searchLabel(`set_id:${clean}`);
}

export async function findLabelByRxcui(rxcui: string): Promise<OpenFdaLabelResult | null> {
  const clean = rxcui.trim();
  if (!clean) return null;
  // Algunos labels indexan rxcui; si no, devolverá null sin fallar.
  return searchLabel(`openfda.rxcui:"${clean}"`);
}
