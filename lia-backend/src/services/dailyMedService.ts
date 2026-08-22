import { DailyMedSplListResponse } from '../models/drugReferenceTypes';
import { fetchJson, foldAccents } from '../utils/externalHttp';

const DAILYMED_SPLS = 'https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json';

/**
 * DailyMed se usa como puente de descubrimiento (setid),
 * luego la ficha se resuelve preferentemente vía openFDA con ese set_id.
 * No hacemos scraping HTML.
 */
export async function findSplSetIdsByRxcui(rxcui: string, limit = 3): Promise<string[]> {
  const url =
    `${DAILYMED_SPLS}?rxcui=${encodeURIComponent(rxcui)}` +
    `&pagesize=${Math.min(Math.max(limit, 1), 5)}`;

  const data = await fetchJson<DailyMedSplListResponse>(url, { timeoutMs: 9000 });
  return (data.data ?? [])
    .map((item) => item.setid?.trim())
    .filter((id): id is string => Boolean(id))
    .slice(0, limit);
}

export async function findSplSetIdsByDrugName(name: string, limit = 3): Promise<string[]> {
  const folded = foldAccents(name).trim();
  if (!folded) return [];

  const url =
    `${DAILYMED_SPLS}?drug_name=${encodeURIComponent(folded)}` +
    `&pagesize=${Math.min(Math.max(limit, 1), 5)}`;

  const data = await fetchJson<DailyMedSplListResponse>(url, { timeoutMs: 9000 });
  return (data.data ?? [])
    .map((item) => item.setid?.trim())
    .filter((id): id is string => Boolean(id))
    .slice(0, limit);
}
