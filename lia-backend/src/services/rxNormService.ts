import {
  DrugSearchResult,
  RxNormApproximateResponse,
  RxNormPropertiesResponse,
  RxNormRelatedResponse,
} from '../models/drugReferenceTypes';
import { asArray, ExternalApiError, fetchJson, foldAccents, titleCaseName } from '../utils/externalHttp';

const RXNORM_BASE = 'https://rxnav.nlm.nih.gov/REST';

export async function searchApproximateTerms(
  query: string,
  maxEntries: number
): Promise<DrugSearchResult[]> {
  const term = foldAccents(query).trim();
  const url =
    `${RXNORM_BASE}/approximateTerm.json` +
    `?term=${encodeURIComponent(term)}` +
    `&maxEntries=${Math.min(Math.max(maxEntries * 3, maxEntries), 40)}` +
    `&option=1`;

  const data = await fetchJson<RxNormApproximateResponse>(url, { timeoutMs: 8000 });
  const candidates = asArray(data.approximateGroup?.candidate);

  // Deduplicar por rxcui; conservar mejor score / rank
  const bestByRxcui = new Map<
    string,
    { rxcui: string; score: number; rank: number; nameHint: string | null }
  >();

  for (const candidate of candidates) {
    const rxcui = candidate.rxcui?.trim();
    if (!rxcui) continue;

    const score = Number(candidate.score ?? 0);
    const rank = Number(candidate.rank ?? 999);
    const nameHint = candidate.name?.trim() || null;
    const existing = bestByRxcui.get(rxcui);

    if (
      !existing ||
      rank < existing.rank ||
      (rank === existing.rank && score > existing.score) ||
      (rank === existing.rank && score === existing.score && !existing.nameHint && nameHint)
    ) {
      bestByRxcui.set(rxcui, { rxcui, score, rank, nameHint });
    }
  }

  const sorted = Array.from(bestByRxcui.values()).sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return b.score - a.score;
  });

  const limited = sorted.slice(0, Math.min(maxEntries * 2, 30));

  const enriched = await Promise.all(
    limited.map(async (item) => {
      const props = await getConceptProperties(item.rxcui);
      if (props?.suppress === 'Y') return null;

      const name = props?.name?.trim() || item.nameHint || item.rxcui;
      const result: DrugSearchResult = {
        id: item.rxcui,
        name,
        displayName: titleCaseName(name),
        tty: props?.tty ?? null,
        source: 'rxnorm',
        score: Number.isFinite(item.score) ? item.score : null,
      };
      return result;
    })
  );

  const usable = enriched.filter((item): item is DrugSearchResult => item !== null);

  const ttyPriority = (tty: string | null): number => {
    switch (tty) {
      case 'IN':
        return 0;
      case 'BN':
        return 1;
      case 'PIN':
        return 2;
      case 'MIN':
        return 3;
      case 'SCD':
      case 'SBD':
        return 4;
      case 'GPCK':
      case 'BPCK':
        return 5;
      default:
        return 6;
    }
  };

  usable.sort((a, b) => {
    const tp = ttyPriority(a.tty) - ttyPriority(b.tty);
    if (tp !== 0) return tp;
    return (b.score ?? 0) - (a.score ?? 0);
  });

  return usable.slice(0, maxEntries);
}

export async function getConceptProperties(rxcui: string): Promise<{
  rxcui: string;
  name: string;
  tty: string | null;
  suppress: string | null;
} | null> {
  const url = `${RXNORM_BASE}/rxcui/${encodeURIComponent(rxcui)}/properties.json`;
  try {
    const data = await fetchJson<RxNormPropertiesResponse>(url, { timeoutMs: 8000 });
    const props = data.properties;
    if (!props?.rxcui || !props.name) return null;
    return {
      rxcui: props.rxcui,
      name: props.name,
      tty: props.tty ?? null,
      suppress: props.suppress ?? null,
    };
  } catch {
    return null;
  }
}

export async function getBrandNames(rxcui: string): Promise<string[]> {
  const url =
    `${RXNORM_BASE}/rxcui/${encodeURIComponent(rxcui)}/related.json?tty=BN`;
  try {
    const data = await fetchJson<RxNormRelatedResponse>(url, { timeoutMs: 8000 });
    const groups = data.relatedGroup?.conceptGroup ?? [];
    const names: string[] = [];
    const seen = new Set<string>();

    for (const group of groups) {
      for (const concept of group.conceptProperties ?? []) {
        const name = concept.name?.trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        names.push(titleCaseName(name));
      }
    }

    return names.slice(0, 12);
  } catch {
    return [];
  }
}

export async function findRxcuiByName(name: string): Promise<string | null> {
  const results = await searchApproximateTerms(name, 1);
  return results[0]?.id ?? null;
}

/**
 * Coincidencia exacta o normalizada. No usa el buscador aproximado:
 * un nombre parecido, como Nalixone y naloxona, no debe resolverse aquí.
 */
export async function findExactRxcuis(name: string): Promise<string[]> {
  const term = foldAccents(name).trim();
  if (term.length < 3) return [];
  const url = `${RXNORM_BASE}/rxcui.json?name=${encodeURIComponent(term)}&search=2`;
  try {
    const data = await fetchJson<{ idGroup?: { rxnormId?: string | string[] } }>(url, { timeoutMs: 8000 });
    const raw = data.idGroup?.rxnormId;
    const ids = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return ids.filter((id) => /^\d+$/.test(id)).slice(0, 4);
  } catch (error) {
    if (error instanceof ExternalApiError && (error.kind === 'not_found' || error.kind === 'http')) {
      return [];
    }
    throw error;
  }
}

/** Identificador ATC de nivel 5. No interpreta un nombre parecido. */
export async function findRxcuisByAtc(code: string): Promise<string[]> {
  if (!/^[A-Z]\d{2}[A-Z]{2}\d{2}$/.test(code)) return [];
  const url = `${RXNORM_BASE}/rxcui.json?idtype=ATC&id=${encodeURIComponent(code)}`;
  try {
    const data = await fetchJson<{ idGroup?: { rxnormId?: string | string[] } }>(url, { timeoutMs: 8000 });
    const raw = data.idGroup?.rxnormId;
    const ids = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return ids.filter((id) => /^\d+$/.test(id)).slice(0, 4);
  } catch (error) {
    if (error instanceof ExternalApiError && (error.kind === 'not_found' || error.kind === 'http')) {
      return [];
    }
    throw error;
  }
}

/** El principio activo de un concepto IN, o el único IN ligado a una sal PIN. */
export async function singleIngredientConcept(
  rxcui: string
): Promise<{ rxcui: string; canonicalName: string } | null> {
  const props = await getConceptProperties(rxcui);
  if (!props || props.suppress === 'Y') return null;
  if (props.tty === 'IN') return { rxcui: props.rxcui, canonicalName: props.name };
  if (props.tty !== 'PIN') return null;
  const url = `${RXNORM_BASE}/rxcui/${encodeURIComponent(props.rxcui)}/related.json?tty=IN`;
  try {
    const data = await fetchJson<RxNormRelatedResponse>(url, { timeoutMs: 8000 });
    const found = new Map<string, string>();
    for (const group of data.relatedGroup?.conceptGroup ?? []) {
      for (const concept of group.conceptProperties ?? []) {
        if (!concept.rxcui || !concept.name) continue;
        found.set(concept.rxcui, concept.name);
      }
    }
    if (found.size !== 1) return null;
    const [id, name] = [...found.entries()][0];
    return { rxcui: id, canonicalName: name };
  } catch (error) {
    if (error instanceof ExternalApiError && (error.kind === 'not_found' || error.kind === 'http')) {
      return null;
    }
    throw error;
  }
}
