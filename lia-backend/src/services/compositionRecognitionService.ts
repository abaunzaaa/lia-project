import { DRUG_INFO_DISCLAIMER, PatientDrugInfo } from '../models/drugReferenceTypes';
import { ObservedIngredient, ObservedPackage, RecognitionResult, VisionRecognitionResult } from '../models/types';
import { AiProviderError } from './aiService';
import {
  type CommercialProduct,
  describeCommercialProduct,
  lookupCommercialCatalog,
} from './commercialCatalogService';
import { DrugChatError, lookupPublicProduct, medicationSourceAgrees } from './drugChatService';
import { findMedication } from '../models/medicationDatabase';
import { lookupSpanishPatientMonograph, PatientMonograph } from './patientMonographService';
import { findLabelByRxcui } from './openFdaService';
import {
  briefPatientLines,
  briefSourcePrecautions,
  cleanIngredientLabel,
  commercialNameAgrees,
  displayIngredientName,
  distinctiveNameTokens,
  foldLabel,
  formatIngredientList,
  ingredientIdentity,
  joinPresentation,
  ListedIngredient,
  parseListedProduct,
  plainVerifiedPurpose,
  plainHormoneReplacement,
  briefMonographPurpose,
  presentationsAgree,
  rejectsConfusedDrug,
  shortenPurpose,
  selectImportantWarnings,
  singleIngredientInName,
  sameFormulation,
  sameIngredient,
  spanishGenericName,
  strengthsAgree,
  withoutSalt,
} from './packageObservation';
import { findExactRxcuis, findRxcuisByAtc, getConceptProperties, singleIngredientConcept } from './rxNormService';
import { ExternalApiError } from '../utils/externalHttp';

export type VerifiedIngredient = {
  rxcui: string;
  canonicalName: string;
};

export type MonographFacts = {
  purpose: string;
  precautions: string[];
  source: string;
};

export type ListedProduct = {
  name: string;
  ingredients: ListedIngredient[];
  presentation: string | null;
  purpose: string | null;
  cautionText: string;
  source: string;
};

type BuiltExplanation = {
  genericName: string | null;
  purpose: string | null;
  precautions: string[];
  presentation: string | null;
  source: string | null;
  rxcui: string | null;
  compositionVerified: boolean;
  observedReading: string | null;
};

export type CompositionDeps = {
  verifyIngredient: (lookupName: string) => Promise<VerifiedIngredient | null>;
  monographFor: (rxcui: string, drugName: string) => Promise<MonographFacts | null>;
  listedProducts: (commercialName: string) => Promise<ListedProduct[]>;
  /** Producto comercial que no está en RxNorm. No completa composición ni precauciones. */
  commercialProduct?: (commercialName: string) => Promise<CommercialProduct | null>;
  /** Si se define, la prueba controlada no consulta fuentes en vivo. */
  nameOnly?: (commercialName: string) => Promise<BuiltExplanation | null>;
};

const EMPTY_DESCRIPTION = 'No se pudo obtener información adicional del medicamento.';
const UNCONFIRMED_COMBINATION = 'Confirmé los componentes, pero no encontré para qué se usa esta combinación.';
const UNCONFIRMED_INGREDIENT = 'Confirmé el principio activo, pero no encontré para qué sirve.';
const SOURCE_DOWN = 'Confirmé lo que contiene. No pude consultar para qué sirve en este momento.';
const IDENTITY_DOWN = 'No pude consultar la identidad de este medicamento en este momento.';
const QUOTA_GAP = 'Confirmé lo que contiene. La consulta de información está temporalmente agotada.';
const LISTED_TTL_MS = 12 * 60 * 60 * 1000;

const PAGE_HOSTS = new Set([
  'beta1.cruzverde.com.co',
  'www.cruzverde.com.co',
  'www.farmatodo.com.co',
  'www.medicamentosplm.com.co',
  'mx.mivademecum.com',
  'www.actuamed.com.mx',
]);

const listedCache = new Map<string, { at: number; items: ListedProduct[] }>();

/**
 * Una palabra genérica del nombre, como «extra», no alcanza para usar otra ficha.
 * La usa solo el reconocimiento del celular.
 */
export function phoneIdentityAgrees(
  requestedName: string,
  info: { name: string; genericName?: string | null; brandNames?: string[] | null }
): boolean {
  const tokens = distinctiveNameTokens(requestedName);
  if (tokens.length === 0) return false;
  return tokens.some((token) =>
    medicationSourceAgrees(token, {
      name: info.name,
      genericName: info.genericName ?? null,
      brandNames: info.brandNames ?? [],
    })
  );
}

async function fetchAllowedText(url: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || !PAGE_HOSTS.has(parsed.hostname)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(parsed, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-CO,es;q=0.9',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function pageMentionsCommercialName(requestedName: string, pageText: string): boolean {
  const tokens = foldLabel(requestedName)
    .split(' ')
    .filter((token) => token.length >= 4);
  const compact = foldLabel(pageText).replace(/ /g, '');
  return tokens.length > 0 && tokens.every((token) => compact.includes(token));
}

function hrefCoversName(requestedName: string, href: string): boolean {
  const tokens = foldLabel(requestedName)
    .split(' ')
    .filter((token) => token.length >= 4);
  let compact = '';
  try {
    compact = foldLabel(decodeURIComponent(href)).replace(/ /g, '');
  } catch {
    compact = foldLabel(href).replace(/ /g, '');
  }
  return tokens.length > 0 && tokens.every((token) => compact.includes(token));
}

function isCatalogProductPath(href: string): boolean {
  return /\/medicamento\/[^"?#]+|\/marca\/\d+|\/productos\/[^"?#]+|cocv_\d+\.html/i.test(href);
}

function plmProductUrls(html: string, requestedName: string): string[] {
  const marker = html.indexOf('var data = ');
  if (marker < 0) return [];
  const start = html.indexOf('[', marker);
  const end = html.indexOf('];', start);
  if (start < 0 || end < 0) return [];
  let rows: unknown;
  try {
    rows = JSON.parse(html.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(rows)) return [];
  const urls: string[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const item = row as {
      type?: unknown;
      data?: {
        DivisionId?: unknown;
        CategoryId?: unknown;
        ProductId?: unknown;
        PharmaFormId?: unknown;
        Label?: unknown;
        PharmaForm?: unknown;
      };
    };
    if (item.type !== 'product' || typeof item.data?.Label !== 'string') continue;
    if (!commercialNameAgrees(requestedName, item.data.Label)) continue;
    const form = typeof item.data.PharmaForm === 'string' ? item.data.PharmaForm : '';
    const division = Number(item.data.DivisionId);
    const category = Number(item.data.CategoryId);
    const product = Number(item.data.ProductId);
    const formId = Number(item.data.PharmaFormId);
    if (![division, category, product, formId].every((value) => Number.isFinite(value) && value > 0)) {
      continue;
    }
    const productSlug = foldLabel(`${item.data.Label} ${form}`).replace(/ /g, '_');
    urls.push(
      `https://www.medicamentosplm.com.co/Home/productos/${productSlug}/${division}/${category}/${product}/${formId}`
    );
  }
  return urls;
}

function catalogLinks(html: string, requestedName: string, origin: string): string[] {
  const urls: string[] = [];
  const anchors = html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi);
  for (const match of anchors) {
    const tag = match[0];
    const hrefRaw = tag.match(/\bhref="([^"]+)"/i)?.[1] || '';
    if (!hrefRaw) continue;
    const href = hrefRaw.replace(/&amp;/gi, '&');
    if (!isCatalogProductPath(href)) continue;
    const aria = tag.match(/aria[-‐]label="([^"]+)"/i)?.[1] || '';
    const strong = tag.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)?.[1] || '';
    const label = `${aria} ${strong}`.replace(/<[^>]+>/g, ' ');
    const slug = href.split('?')[0].split('/').filter(Boolean).pop() || '';
    const agrees =
      commercialNameAgrees(requestedName, label) ||
      commercialNameAgrees(requestedName, slug.replace(/[-_]+/g, ' ')) ||
      (/cocv_\d+\.html/i.test(href) && hrefCoversName(requestedName, href));
    if (!agrees) continue;
    let absolute = href;
    if (href.startsWith('/')) absolute = `${origin}${href}`;
    if (!absolute.startsWith('https://')) continue;
    urls.push(absolute.split('#')[0]);
    if (urls.length >= 2) break;
  }
  return urls;
}

/** Direcciones de ficha que salen de un resultado de búsqueda ya descargado. */
export function combinationSheetUrls(
  name: string,
  documents: Array<{ html: string; origin: string }>
): string[] {
  const urls: string[] = [];
  for (const document of documents) {
    urls.push(...plmProductUrls(document.html, name));
    urls.push(...catalogLinks(document.html, name, document.origin));
  }
  return [...new Set(urls)].slice(0, 4);
}

function sourceLabel(url: string): string {
  if (url.includes('medicamentosplm.com')) return 'Medicamentos PLM';
  if (url.includes('mivademecum.com')) return 'Mi Vademécum';
  if (url.includes('actuamed.com')) return 'Actuamed';
  if (url.includes('cruzverde.com')) return 'Cruz Verde';
  if (url.includes('farmatodo.com')) return 'Farmatodo';
  return 'ficha pública';
}

async function readProductPages(
  name: string,
  documents: Array<{ html: string; origin: string }>
): Promise<ListedProduct[]> {
  const urls = combinationSheetUrls(name, documents).slice(0, 2);
  const pages = await Promise.all(urls.map(async (url) => ({ url, html: await fetchAllowedText(url) })));
  const found: ListedProduct[] = [];
  for (const page of pages) {
    if (!page.html || !pageMentionsCommercialName(name, page.html)) continue;
    const parsed = parseListedProduct(page.html, name);
    if (!parsed || parsed.ingredients.length === 0) continue;
    found.push({ ...parsed, source: sourceLabel(page.url) });
  }
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[phone-composition] fichas ${name}: urls=${urls.length} leidas=${found.length}`);
  }
  return found;
}

async function fetchListedProducts(name: string): Promise<ListedProduct[]> {
  const key = cleanIngredientLabel(name);
  if (!key) return [];
  const cached = listedCache.get(key);
  if (cached && Date.now() - cached.at < LISTED_TTL_MS) return cached.items;
  if (cached) listedCache.delete(key);

  const plmSearch = (query: string) =>
    `https://www.medicamentosplm.com.co/Home/Busqueda?q=${encodeURIComponent(query)}`;
  let plm = await fetchAllowedText(plmSearch(name));
  if (!plm || plmProductUrls(plm, name).length === 0) {
    const brand = foldLabel(name)
      .split(' ')
      .find((token) => token.length >= 5 && !['extra', 'fuerte', 'forte', 'plus', 'maxi'].includes(token));
    if (brand && foldLabel(name) !== brand) {
      plm = (await fetchAllowedText(plmSearch(brand))) || plm;
    }
  }
  let found = await readProductPages(name, [
    { html: plm || '', origin: 'https://www.medicamentosplm.com.co' },
  ]);
  if (!found.some((item) => item.purpose && plainVerifiedPurpose(item.purpose))) {
    const vademecum = await fetchAllowedText(
      `https://mx.mivademecum.com/buscar?q=${encodeURIComponent(name)}`
    );
    const extra = await readProductPages(name, [
      { html: vademecum || '', origin: 'https://mx.mivademecum.com' },
    ]);
    found = [...found, ...extra];
  }
  if (found.length > 0) listedCache.set(key, { at: Date.now(), items: found });
  return found;
}

export async function lookupCombinationSheets(name: string): Promise<ListedProduct[]> {
  return fetchListedProducts(name);
}

export function acceptGroundedSheet(name: string, text: string): ListedProduct | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as {
    found?: unknown;
    name?: unknown;
    ingredients?: unknown;
    presentation?: unknown;
    purpose?: unknown;
    cautions?: unknown;
    sourceName?: unknown;
  };
  if (record.found !== true || typeof record.name !== 'string' || !record.name.trim()) return null;
  if (!medicationSourceAgrees(name, { name: record.name, genericName: record.name, brandNames: [] })) {
    return null;
  }
  if (!Array.isArray(record.ingredients)) return null;
  const ingredients: ListedIngredient[] = [];
  for (const item of record.ingredients) {
    if (!item || typeof item !== 'object') return null;
    const ingredientName = typeof (item as { name?: unknown }).name === 'string'
      ? (item as { name: string }).name.trim()
      : '';
    const strength = typeof (item as { strength?: unknown }).strength === 'string'
      ? (item as { strength: string }).strength.trim()
      : null;
    if (!ingredientName) return null;
    ingredients.push({ name: ingredientName, strength });
  }
  const purpose = typeof record.purpose === 'string' ? record.purpose.trim() : '';
  const sourceName = typeof record.sourceName === 'string' ? record.sourceName.trim() : '';
  if (!purpose || !sourceName || ingredients.length === 0) return null;
  const parsed = parseListedProduct(
    `PRINCIPIO ACTIVO: ${ingredients.map((item) => item.name).join('+')} CONCENTRACIÓN: ${ingredients
      .map((item) => item.strength || '')
      .join('+')} PRESENTACIÓN: ${typeof record.presentation === 'string' ? record.presentation : ''} INDICACIONES: ${purpose}`,
    name
  );
  if (!parsed) return null;
  return {
    ...parsed,
    cautionText: typeof record.cautions === 'string' ? record.cautions : '',
    source: sourceName,
  };
}

const identityCache = new Map<string, { at: number; value: VerifiedIngredient | null }>();
const IDENTITY_TTL_MS = 12 * 60 * 60 * 1000;
const IDENTITY_MISS_TTL_MS = 15 * 60 * 1000;

async function conceptFromExact(query: string): Promise<VerifiedIngredient | null> {
  const ids = await findExactRxcuis(query);
  const accepted: VerifiedIngredient[] = [];
  for (const id of ids) {
    const props = await getConceptProperties(id);
    if (!props || props.suppress === 'Y') continue;
    if (props.tty !== 'IN' && props.tty !== 'PIN') continue;
    if (rejectsConfusedDrug(query, props.name)) continue;
    accepted.push({ rxcui: props.rxcui, canonicalName: props.name });
  }
  const unique = [...new Map(accepted.map((item) => [item.rxcui, item])).values()];
  return unique.length === 1 ? unique[0] : null;
}

async function verifyExactIngredient(lookupName: string): Promise<VerifiedIngredient | null> {
  const key = cleanIngredientLabel(lookupName);
  const cached = key ? identityCache.get(key) : undefined;
  if (cached) {
    const ttl = cached.value ? IDENTITY_TTL_MS : IDENTITY_MISS_TTL_MS;
    if (Date.now() - cached.at < ttl) return cached.value;
    identityCache.delete(key);
  }
  const queries = [...new Set([lookupName.trim(), withoutSalt(lookupName)].filter((item) => item.length >= 3))];
  let resolved: VerifiedIngredient | null = null;
  for (const query of queries) {
    resolved = await conceptFromExact(query);
    if (resolved) break;
  }
  if (!resolved) {
    resolved = await conceptFromPharmacopoeia(withoutSalt(lookupName) || lookupName.trim());
  }
  if (key) identityCache.set(key, { at: Date.now(), value: resolved });
  return resolved;
}

type CimaListItem = { nregistro?: string; nombre?: string };
type CimaDetail = {
  atcs?: Array<{ codigo?: string; nivel?: number }>;
  principiosActivos?: Array<{ nombre?: string }>;
};

function substanceAtc(detail: CimaDetail): string | null {
  const codes = (detail.atcs || [])
    .filter((item) => item.nivel === 5 && typeof item.codigo === 'string' && /^[A-Z]\d{2}[A-Z]{2}\d{2}$/.test(item.codigo))
    .map((item) => item.codigo as string);
  const unique = [...new Set(codes)];
  return unique.length === 1 ? unique[0] : null;
}

function listedActiveAgrees(detail: CimaDetail, query: string): boolean {
  const actives = (detail.principiosActivos || [])
    .map((item) => item.nombre?.trim() || '')
    .filter(Boolean);
  if (actives.length !== 1) return false;
  const base = withoutSalt(query);
  return Boolean(base) && withoutSalt(actives[0]) === base;
}

async function fetchCimaJson(path: string): Promise<unknown | null> {
  const url = new URL(path, 'https://cima.aemps.es');
  if (url.hostname !== 'cima.aemps.es') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'LiaMedicationLookup/1.0' },
    });
    if (!response.ok || new URL(response.url).hostname !== 'cima.aemps.es') return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Nombre en español que RxNorm no normaliza.
 * Se acepta solo si la ficha de la AEMPS trae un único ATC de sustancia
 * y ese código corresponde a un solo principio activo en RxNorm.
 */
async function conceptFromPharmacopoeia(query: string): Promise<VerifiedIngredient | null> {
  const base = withoutSalt(query);
  if (base.length < 6) return null;
  const listed = await fetchCimaJson(`/cima/rest/medicamentos?nombre=${encodeURIComponent(base)}`);
  const results = (listed as { resultados?: CimaListItem[] } | null)?.resultados || [];
  const candidates = results
    .filter((item) => Boolean(item.nregistro && foldLabel(item.nombre || '').split(' ').includes(base)))
    .slice(0, 6);
  const codes = new Set<string>();
  let agreed = 0;
  for (const item of candidates) {
    if (agreed >= 2) break;
    const detail = (await fetchCimaJson(
      `/cima/rest/medicamento?nregistro=${encodeURIComponent(item.nregistro || '')}`
    )) as CimaDetail | null;
    if (!detail || !listedActiveAgrees(detail, base)) continue;
    const code = substanceAtc(detail);
    if (!code) continue;
    codes.add(code);
    agreed += 1;
  }
  if (codes.size !== 1) return null;
  const atc = [...codes][0];
  const ids = await findRxcuisByAtc(atc);
  const ingredients: VerifiedIngredient[] = [];
  for (const id of ids) {
    const ingredient = await singleIngredientConcept(id);
    if (!ingredient || rejectsConfusedDrug(query, ingredient.canonicalName)) continue;
    ingredients.push(ingredient);
  }
  const unique = [...new Map(ingredients.map((item) => [item.rxcui, item])).values()];
  if (unique.length !== 1) return null;
  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[phone-composition] identidad ${base} atc=${atc} rxcui=${unique[0].rxcui} nombre=${unique[0].canonicalName}`
    );
  }
  return unique[0];
}

export async function lookupIngredientIdentity(name: string): Promise<VerifiedIngredient | null> {
  return verifyExactIngredient(name);
}

function warningsFromSheet(text: string): string[] {
  const selected = selectImportantWarnings(text);
  return selected.length > 0 ? selected : briefSourcePrecautions(text);
}

async function purposeFromOfficialLabel(
  rxcui: string
): Promise<{ purpose: string; precautions: string[] } | null> {
  const label = await findLabelByRxcui(rxcui);
  if (!label) return null;
  const labelIds = label.openfda?.rxcui || [];
  if (!labelIds.includes(rxcui)) return null;
  const indication = [...(label.indications_and_usage || []), ...(label.purpose || [])].join(' ').slice(0, 900);
  const purpose = plainVerifiedPurpose(indication);
  if (!purpose) return null;
  const caution = [...(label.warnings || []), ...(label.do_not_use || [])].join(' ').slice(0, 1600);
  const selected = selectImportantWarnings(caution);
  return { purpose, precautions: selected.length > 0 ? selected : briefSourcePrecautions(caution) };
}

function factsFromMonograph(page: PatientMonograph): MonographFacts | null {
  const full = page.purpose.replace(/\s+/g, ' ').trim();
  const adapted = plainHormoneReplacement(full);
  const sentence =
    adapted ||
    full
      .split(/(?<=\.)\s+/)
      .map((part) => part.trim())
      .find((part) => part.length > 0 && !part.startsWith('¿')) ||
    '';
  if (!sentence && !adapted) return null;
  const selected = selectImportantWarnings(
    `${page.boxedWarning || ''}\n${page.precautions}\n${page.adverse}`
  );
  const precautions =
    selected.length > 0 ? selected : briefPatientLines(briefSourcePrecautions(`${page.precautions}\n${page.adverse}`));
  if (
    /cantidad superior|m[aá]s de la indicada|sobredosis|dosis m[aá]xima/i.test(`${page.precautions} ${page.administration}`) &&
    !precautions.some((line) => /empaque o tu m[eé]dico/i.test(line))
  ) {
    precautions.unshift('No tomes más de lo que indica el empaque o tu médico.');
  }
  return {
    purpose: adapted || briefMonographPurpose(full) || shortenPurpose(sentence),
    precautions: [...new Set(precautions)].slice(0, 8),
    source: 'MedlinePlus',
  };
}

async function monographForIngredient(rxcui: string, drugName: string): Promise<MonographFacts | null> {
  const page = await lookupSpanishPatientMonograph({ rxcui, drugName });
  if (!page) return null;
  return factsFromMonograph(page);
}

export const defaultCompositionDeps: CompositionDeps = {
  verifyIngredient: verifyExactIngredient,
  monographFor: monographForIngredient,
  listedProducts: fetchListedProducts,
};

function unverifiedReading(name: string, observed: ObservedPackage): string {
  const ingredients = formatIngredientList(
    observed.ingredients.map((item) => ({
      name: displayIngredientName(item.name),
      strength: item.strength,
    }))
  );
  const where = joinPresentation(observed.presentation, observed.route);
  const detail = [ingredients, where].filter(Boolean).join(', en ');
  const lead = detail ? `En la foto de ${name} se lee ${detail}` : `En la foto se lee ${name}`;
  return `${lead}. Esa composición no quedó confirmada.`;
}

function verifiedIngredients(
  observed: ObservedIngredient[],
  verified: Array<VerifiedIngredient | null>
): Array<{ name: string; strength: string | null; rxcui: string }> | null {
  if (observed.length === 0 || verified.some((item) => !item)) return null;
  return observed.map((item, index) => ({
    name: displayIngredientName(item.name, verified[index]?.canonicalName),
    strength: item.strength,
    rxcui: verified[index]?.rxcui || '',
  }));
}

async function explainPackage(
  name: string,
  observed: ObservedPackage,
  deps: CompositionDeps
): Promise<BuiltExplanation> {
  let identityDown = false;
  const checks = await Promise.all(
    observed.ingredients.map(async (ingredient) => {
      const identity = ingredientIdentity(ingredient.name);
      const lookup = identity?.lookup || withoutSalt(ingredient.name) || ingredient.name.trim();
      if (rejectsConfusedDrug(ingredient.name, lookup) || rejectsConfusedDrug(name, lookup)) return null;
      try {
        const verified = await deps.verifyIngredient(lookup);
        if (!verified || rejectsConfusedDrug(ingredient.name, verified.canonicalName)) return null;
        if (rejectsConfusedDrug(name, verified.canonicalName)) return null;
        return verified;
      } catch (error) {
        if (error instanceof AiProviderError && error.httpStatus === 429) throw error;
        if (error instanceof ExternalApiError && (error.kind === 'network' || error.kind === 'timeout')) {
          identityDown = true;
        }
        return null;
      }
    })
  );
  const confirmed = verifiedIngredients(observed.ingredients, checks);
  if (!confirmed) {
    const commercial = observed.ingredients.length < 2 ? await commercialWhenUnverified(name, deps) : null;
    return {
      genericName: null,
      purpose: commercial?.purpose || (identityDown ? IDENTITY_DOWN : null),
      precautions: [],
      presentation: commercial?.presentation || null,
      source: commercial?.source || null,
      rxcui: null,
      compositionVerified: false,
      observedReading: unverifiedReading(name, observed),
    };
  }

  const presentation = joinPresentation(observed.presentation, observed.route);
  const genericName = formatIngredientList(confirmed);

  if (confirmed.length === 1) {
    const only = confirmed[0];
    const canonical = checks.find((item) => item?.rxcui === only.rxcui)?.canonicalName || only.name;
    let facts: MonographFacts | null = null;
    let monographDown = false;
    try {
      facts = await deps.monographFor(only.rxcui, only.name);
      if (!facts?.purpose && canonical !== only.name) {
        facts = await deps.monographFor(only.rxcui, canonical);
      }
    } catch (error) {
      if (error instanceof AiProviderError && error.httpStatus === 429) {
        return verifiedGap(genericName, presentation, only.rxcui, QUOTA_GAP);
      }
      if (error instanceof ExternalApiError) monographDown = true;
      facts = null;
    }
    if (facts?.purpose) {
      return {
        genericName,
        purpose: shortenPurpose(facts.purpose),
        precautions: briefPatientLines(facts.precautions || []),
        presentation,
        source: facts.source || null,
        rxcui: only.rxcui,
        compositionVerified: true,
        observedReading: null,
      };
    }
    try {
      const labeled = await purposeFromOfficialLabel(only.rxcui);
      if (labeled) {
        return {
          genericName,
          purpose: labeled.purpose,
          precautions: labeled.precautions,
          presentation,
          source: 'etiqueta pública del medicamento',
          rxcui: only.rxcui,
          compositionVerified: true,
          observedReading: null,
        };
      }
    } catch (error) {
      if (error instanceof ExternalApiError) monographDown = true;
    }
    const sheets = await loadSheets(name, deps);
    if (sheets.quota) return verifiedGap(genericName, presentation, only.rxcui, QUOTA_GAP);
    let singleSheet: ListedProduct | undefined;
    for (const item of sheets.items) {
      if (!item.purpose || !plainVerifiedPurpose(item.purpose)) continue;
      if (await singleIngredientMatches(observed, only.rxcui, item, deps)) {
        singleSheet = item;
        break;
      }
    }
    if (singleSheet?.purpose) {
      return {
        genericName,
        purpose: plainVerifiedPurpose(singleSheet.purpose) || UNCONFIRMED_INGREDIENT,
        precautions: warningsFromSheet(singleSheet.cautionText),
        presentation,
        source: singleSheet.source,
        rxcui: only.rxcui,
        compositionVerified: true,
        observedReading: null,
      };
    }
    return verifiedGap(
      genericName,
      presentation,
      only.rxcui,
      sheets.down || monographDown ? SOURCE_DOWN : UNCONFIRMED_INGREDIENT
    );
  }

  const sheets = await loadSheets(name, deps);
  if (sheets.quota) return verifiedGap(genericName, presentation, null, QUOTA_GAP);
  let matched: ListedProduct | undefined;
  for (const item of sheets.items) {
    if (!item.purpose || !plainVerifiedPurpose(item.purpose)) continue;
    if (await formulationMatches(observed, confirmed, item, deps)) {
      matched = item;
      break;
    }
  }
  const purpose = matched?.purpose ? plainVerifiedPurpose(matched.purpose) : null;
  if (!matched || !purpose) {
    return verifiedGap(
      genericName,
      presentation,
      null,
      sheets.down ? SOURCE_DOWN : UNCONFIRMED_COMBINATION
    );
  }
  return {
    genericName,
    purpose,
    precautions: warningsFromSheet(matched.cautionText),
    presentation,
    source: matched.source,
    rxcui: null,
    compositionVerified: true,
    observedReading: null,
  };
}

function verifiedGap(
  genericName: string,
  presentation: string | null,
  rxcui: string | null,
  purpose: string
): BuiltExplanation {
  return {
    genericName,
    purpose,
    precautions: [],
    presentation,
    source: null,
    rxcui,
    compositionVerified: true,
    observedReading: null,
  };
}

async function sameVerifiedIngredient(
  observedName: string,
  observedRxcui: string,
  sheetName: string,
  deps: CompositionDeps
): Promise<boolean> {
  if (sameIngredient(observedName, sheetName)) return true;
  if (!observedRxcui) return false;
  try {
    const verified = await deps.verifyIngredient(sheetName);
    return Boolean(
      verified &&
        verified.rxcui === observedRxcui &&
        !rejectsConfusedDrug(observedName, verified.canonicalName) &&
        !rejectsConfusedDrug(sheetName, verified.canonicalName)
    );
  } catch (error) {
    if (error instanceof AiProviderError && error.httpStatus === 429) throw error;
    return false;
  }
}

async function singleIngredientMatches(
  observed: ObservedPackage,
  observedRxcui: string,
  item: ListedProduct,
  deps: CompositionDeps
): Promise<boolean> {
  if (observed.ingredients.length !== 1 || item.ingredients.length !== 1) return false;
  if (!presentationsAgree(observed.presentation, item.presentation)) return false;
  const left = observed.ingredients[0];
  const right = item.ingredients[0];
  if (!left.strength || !strengthsAgree(left.strength, right.strength)) return false;
  return sameVerifiedIngredient(left.name, observedRxcui, right.name, deps);
}

async function formulationMatches(
  observed: ObservedPackage,
  confirmed: Array<{ name: string; strength: string | null; rxcui: string }>,
  item: ListedProduct,
  deps: CompositionDeps
): Promise<boolean> {
  if (
    sameFormulation(observed, {
      ingredients: item.ingredients,
      presentation: item.presentation,
    })
  ) {
    return true;
  }
  if (observed.ingredients.length < 2 || item.ingredients.length !== observed.ingredients.length) return false;
  if (!presentationsAgree(observed.presentation, item.presentation)) return false;
  const pending = item.ingredients.map((ingredient) => ({ ...ingredient, used: false }));
  for (let index = 0; index < observed.ingredients.length; index += 1) {
    const ingredient = observed.ingredients[index];
    if (!ingredient.strength) return false;
    let found = -1;
    for (let sheetIndex = 0; sheetIndex < pending.length; sheetIndex += 1) {
      const candidate = pending[sheetIndex];
      if (candidate.used || !strengthsAgree(ingredient.strength, candidate.strength)) continue;
      if (await sameVerifiedIngredient(ingredient.name, confirmed[index]?.rxcui || '', candidate.name, deps)) {
        found = sheetIndex;
        break;
      }
    }
    if (found < 0) return false;
    pending[found].used = true;
  }
  return pending.every((candidate) => candidate.used);
}

async function commercialWhenUnverified(
  name: string,
  deps: CompositionDeps
): Promise<{ purpose: string; presentation: string | null; source: string } | null> {
  const lookup = deps.commercialProduct ?? lookupCommercialCatalog;
  try {
    const product = await lookup(name);
    if (!product?.purpose) return null;
    return {
      purpose: shortenPurpose(describeCommercialProduct(product)),
      presentation: product.form,
      source: product.source,
    };
  } catch (error) {
    if (error instanceof AiProviderError && error.httpStatus === 429) throw error;
    return null;
  }
}

async function loadSheets(
  name: string,
  deps: CompositionDeps
): Promise<{ items: ListedProduct[]; down: boolean; quota: boolean }> {
  try {
    return { items: await deps.listedProducts(name), down: false, quota: false };
  } catch (error) {
    if (error instanceof AiProviderError && error.httpStatus === 429) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[phone-composition] sheet http=429 category=${error.quota ?? 'unknown'}`);
      }
      return { items: [], down: false, quota: true };
    }
    if (error instanceof ExternalApiError) return { items: [], down: true, quota: false };
    throw error;
  }
}

function patientFromExplanation(name: string, explanation: BuiltExplanation): PatientDrugInfo | null {
  if (!explanation.compositionVerified && !explanation.purpose && !explanation.genericName) return null;
  return {
    id: explanation.rxcui,
    name,
    genericName: explanation.genericName,
    brandNames: [],
    purpose: explanation.purpose,
    importantInformation: explanation.precautions,
    precautions: [],
    dosageForms: explanation.presentation ? [explanation.presentation] : [],
    source: explanation.source ? { name: 'Public', reference: explanation.source } : null,
    language: 'es',
    simplified: true,
    informationAvailable: Boolean(explanation.purpose || explanation.genericName),
    disclaimer: DRUG_INFO_DISCLAIMER,
  };
}

function voiceFrom(name: string, explanation: BuiltExplanation): string {
  const ingredientLabel =
    explanation.genericName && explanation.genericName.includes(' y ')
      ? `Principios activos: ${explanation.genericName}`
      : explanation.genericName
        ? `Principio activo: ${explanation.genericName}`
        : '';
  const text = [
    name,
    ingredientLabel,
    explanation.presentation ? `Presentación: ${explanation.presentation}` : '',
    explanation.purpose || '',
    explanation.observedReading || '',
    ...explanation.precautions.slice(0, 6),
  ]
    .filter(Boolean)
    .join('. ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= 520) return text;
  const cut = text.slice(0, 520);
  const end = cut.lastIndexOf('.');
  return end > 160 ? cut.slice(0, end + 1) : cut.trim();
}

function toResult(
  vision: VisionRecognitionResult,
  name: string,
  explanation: BuiltExplanation
): RecognitionResult {
  const patientInfo = patientFromExplanation(name, explanation);
  const description = explanation.purpose || EMPTY_DESCRIPTION;
  return {
    name,
    description,
    dose: explanation.presentation || '',
    confidence: vision.confidence,
    rxcui: explanation.rxcui,
    patientInfo,
    voiceText: voiceFrom(name, explanation),
    identified: true,
    observedPackage: vision.observedPackage ?? null,
    compositionVerified: explanation.compositionVerified,
  };
}

function presentKnownPatient(name: string, patient: PatientDrugInfo): BuiltExplanation {
  const genericName = spanishGenericName(patient.genericName);
  const lines = briefPatientLines([...(patient.importantInformation || []), ...(patient.precautions || [])]);
  return {
    genericName,
    purpose: patient.purpose ? shortenPurpose(patient.purpose) : null,
    precautions: lines,
    presentation: null,
    source: patient.source?.reference || (patient.source?.name && patient.source.name !== 'Public' ? patient.source.name : null),
    rxcui: patient.id,
    compositionVerified: false,
    observedReading: null,
  };
}

async function explainNameOnly(
  name: string,
  deps: CompositionDeps
): Promise<BuiltExplanation | null> {
  const embedded = singleIngredientInName(name);
  if (embedded && !rejectsConfusedDrug(name, embedded.lookup)) {
    try {
      const verified = await deps.verifyIngredient(embedded.lookup);
      if (verified && !rejectsConfusedDrug(name, verified.canonicalName)) {
        const facts = await deps.monographFor(verified.rxcui, embedded.display);
        if (facts) {
          return {
            genericName: embedded.display,
            purpose: shortenPurpose(facts.purpose),
            precautions: briefPatientLines(facts.precautions),
            presentation: null,
            source: facts.source,
            rxcui: verified.rxcui,
            compositionVerified: false,
            observedReading: null,
          };
        }
      }
    } catch (error) {
      if (error instanceof AiProviderError && error.httpStatus === 429) throw error;
    }
  }
  return null;
}

async function catalogExplanation(name: string): Promise<BuiltExplanation | null> {
  const listed = await lookupCommercialCatalog(name);
  if (listed) {
    return {
      genericName: null,
      purpose: shortenPurpose(describeCommercialProduct(listed)),
      precautions: [],
      presentation: listed.form,
      source: listed.source,
      rxcui: null,
      compositionVerified: false,
      observedReading: null,
    };
  }
  const local = findMedication(name);
  if (
    local &&
    medicationSourceAgrees(name, { name: local.name, genericName: local.name, brandNames: local.aliases })
  ) {
    return {
      genericName: null,
      purpose: shortenPurpose(local.description),
      precautions: [],
      presentation: null,
      source: 'catálogo local',
      rxcui: null,
      compositionVerified: false,
      observedReading: null,
    };
  }
  try {
    const commercial = await lookupPublicProduct(name);
    if (commercial?.uses[0] && medicationSourceAgrees(name, commercial)) {
      return {
        genericName: null,
        purpose: shortenPurpose(commercial.uses[0]),
        precautions: briefPatientLines(commercial.warnings),
        presentation: commercial.dosageForms[0] || null,
        source: commercial.source.reference,
        rxcui: null,
        compositionVerified: false,
        observedReading: null,
      };
    }
  } catch (error) {
    if (error instanceof AiProviderError && error.httpStatus === 429) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[phone-composition] public http=429 category=${error.quota ?? 'unknown'}`);
      }
      return null;
    }
    if (!(error instanceof DrugChatError)) throw error;
  }
  return null;
}

async function explainCommercialName(name: string): Promise<BuiltExplanation | null> {
  const { enrichRecognizedName } = await import('./medicationRecognitionService');
  const enriched = await enrichRecognizedName(name, { requireDistinctiveToken: true });
  if (enriched.patientInfo && phoneIdentityAgrees(name, enriched.patientInfo)) {
    return presentKnownPatient(name, enriched.patientInfo);
  }
  return catalogExplanation(name);
}

/**
 * Reconocimiento del celular: usa la composición leída en el empaque
 * y solo explica lo que quedó verificado para esa formulación.
 */
export async function explainMobileRecognition(
  vision: VisionRecognitionResult,
  deps: CompositionDeps = defaultCompositionDeps
): Promise<RecognitionResult> {
  const name = vision.name.trim();
  const identified = Boolean(vision.identified && name);
  if (!identified) {
    return {
      name: name || '',
      description: EMPTY_DESCRIPTION,
      dose: '',
      confidence: vision.confidence,
      rxcui: null,
      patientInfo: null,
      voiceText: null,
      identified: false,
      observedPackage: vision.observedPackage ?? null,
      compositionVerified: false,
    };
  }

  const observed = vision.observedPackage;
  let explanation: BuiltExplanation | null = null;
  if (observed && observed.ingredients.length > 0) {
    explanation = await explainPackage(name, observed, deps);
  } else if (deps.nameOnly) {
    explanation = await deps.nameOnly(name);
  } else {
    explanation = (await explainNameOnly(name, deps)) || (await explainCommercialName(name));
  }

  if (!explanation) {
    return {
      name,
      description: EMPTY_DESCRIPTION,
      dose: '',
      confidence: vision.confidence,
      rxcui: null,
      patientInfo: null,
      voiceText: `${name}. No confirmé su composición ni para qué se usa.`,
      identified: true,
      observedPackage: observed ?? null,
      compositionVerified: false,
    };
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[phone-composition] name=${name} ingredients=${observed?.ingredients.length ?? 0} verified=${explanation.compositionVerified} purpose=${explanation.purpose ? 'yes' : 'no'}`
    );
  }
  return toResult(vision, name, explanation);
}
