import { DrugInfo } from '../models/drugReferenceTypes';

/**
 * Nombre comercial que no está en RxNorm, openFDA ni DailyMed.
 * Se consulta el título público del mismo nombre. No hay respuestas fijas por producto.
 */

export type CommercialProduct = {
  name: string;
  purpose: string;
  form: string | null;
  source: string;
};

const CACHE = new Map<string, CommercialProduct | null>();

const CATALOGS = [
  {
    source: 'Cruz Verde',
    url: (name: string) =>
      `https://beta1.cruzverde.com.co/on/demandware.store/Sites-Colombia-Site/default/SearchServices-GetSuggestions?q=${encodeURIComponent(name)}`,
  },
  {
    source: 'Farmatodo',
    url: (name: string) => `https://www.farmatodo.com.co/a/p/${slug(name)}.html`,
  },
] as const;

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slug(value: string): string {
  return fold(value).replace(/ /g, '');
}

function decodeHtml(value: string): string {
  return value
    .replace(/&oacute;/gi, 'ó')
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/&uuml;/gi, 'ü')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function sameProduct(requestedName: string, label: string): boolean {
  const requested = fold(requestedName).split(' ').filter((token) => token.length >= 4);
  const other = fold(label);
  if (requested.length === 0 || !other) return false;
  return requested.every((token) => other.split(' ').includes(token) || other.includes(token));
}

function detectForm(label: string): string | null {
  const text = fold(label);
  if (/solucion espumosa/.test(text)) return 'solución espumosa';
  if (/\bespuma\b/.test(text)) return 'espuma';
  if (/capsulas?/.test(text)) return 'cápsulas';
  if (/tabletas?/.test(text)) return 'tabletas';
  if (/\bjarabe\b/.test(text)) return 'jarabe';
  if (/\bgotas\b/.test(text)) return 'gotas';
  if (/\bcrema\b/.test(text)) return 'crema';
  if (/\btoallas?\b/.test(text)) return 'toallas';
  return null;
}

function cleanPurpose(value: string): string | null {
  const cut = value.split(/[.!?]/)[0] || value;
  const purpose = cut
    .replace(/\b(encu[eé]ntral[oa]|comprar|precio|oferta)\b.*$/i, '')
    .replace(/\b(frasco|fco|caja|sobre|tubo|tarro|blister|blíster)\b.*$/i, '')
    .replace(/[.,;:\s]+$/g, '')
    .trim()
    .toLocaleLowerCase('es');
  if (purpose.length < 8) return null;
  if (/encuentr|carrito|oferta|precio|farmatodo|cruz verde/i.test(purpose)) return null;
  const accented = purpose
    .replace(/\bparpados\b/g, 'párpados')
    .replace(/\bpestanas\b/g, 'pestañas');
  if (/^limpieza\b/.test(accented)) return `la ${accented}`;
  return accented;
}

/** Título comercial con un uso explícito. «Tabletas caja x 12» no alcanza. */
export function purposeFromCatalogTitle(requestedName: string, title: string): CommercialProduct | null {
  const label = decodeHtml(title);
  if (!label || !sameProduct(requestedName, label)) return null;
  const match = label.match(/\bpara\s+(.+)/i);
  if (!match?.[1]) return null;
  const purpose = cleanPurpose(match[1]);
  if (!purpose) return null;
  return {
    name: requestedName.trim(),
    purpose,
    form: detectForm(label),
    source: 'título comercial',
  };
}

/** Primera frase de una descripción pública, si dice para qué es el mismo producto. */
export function purposeFromCatalogDescription(
  requestedName: string,
  description: string
): CommercialProduct | null {
  const text = decodeHtml(description);
  const sentence = text.split(/[.!?]/)[0]?.trim() || '';
  if (!sentence || !sameProduct(requestedName, sentence)) return null;
  if (!/dolor|limpieza|higien|infecci|alivi|trata|analgés|analges|sirve|control|limpiar/i.test(sentence)) {
    return null;
  }
  const purpose = cleanPurpose(
    sentence
      .replace(/^[^.]{0,40}?\bes\b\s+/i, '')
      .replace(/,?\s*es de venta libre.*$/i, '')
      .replace(/\s*y puedes encontrarlo.*$/i, '')
  );
  if (!purpose) return null;
  return {
    name: requestedName.trim(),
    purpose,
    form: detectForm(sentence),
    source: 'descripción comercial',
  };
}

export function describeCommercialProduct(product: CommercialProduct): string {
  const name = product.name.trim();
  const purpose = product.purpose.replace(/\.$/, '');
  const form = product.form;
  const identity = !form
    ? name
    : /^(soluci[oó]n|espuma|crema|jarabe)/i.test(form)
      ? `${name} es una ${form}`
      : `${name} se presenta en ${form}`;
  return `${identity}. Se utiliza para ${purpose}.`;
}

export function commercialDrugInfo(product: CommercialProduct): DrugInfo {
  return {
    id: '',
    name: product.name,
    genericName: null,
    brandNames: [],
    summary: product.purpose,
    uses: [product.purpose],
    warnings: [],
    precautions: [],
    dosageAndAdministration: [],
    whenUsing: [],
    storage: [],
    interactions: [],
    dosageForms: product.form ? [product.form] : [],
    informationAvailable: true,
    source: { name: 'Public', reference: product.source },
    disclaimer: 'Información pública del producto. No es una receta ni una dosis personal.',
  };
}

function labelsFromSuggestions(html: string): string[] {
  const found = [
    ...html.matchAll(/\balt="([^"]+)"/g),
    ...html.matchAll(/aria[\u2010-]label="([^"]+)"/g),
  ].map((match) => decodeHtml(match[1] || ''));
  return [...new Set(found)].filter((label) => label.length > 2 && !/sugerenc|búsqueda|buscar/i.test(label));
}

function fromFarmatodo(html: string, requestedName: string): CommercialProduct | null {
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1] || '';
  const meta = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1]
    || html.match(/<meta[^>]+content="([^"]+)"[^>]+name="description"/i)?.[1]
    || '';
  const text = decodeHtml(html.replace(/<[^>]+>/g, ' '));
  const spoken = text.match(/se us(?:a|an) para ([^.]{8,160})/i)?.[1] || '';
  const fromSpeech = spoken && sameProduct(requestedName, text.slice(0, 800))
    ? cleanPurpose(spoken.split(',')[0] || spoken)
    : null;
  const fromTitle = purposeFromCatalogTitle(requestedName, title);
  const fromMeta = purposeFromCatalogDescription(requestedName, meta);
  const chosen = fromTitle || fromMeta;
  const purpose = fromSpeech && fromSpeech.length > (chosen?.purpose.length || 0)
    ? fromSpeech
    : chosen?.purpose;
  if (!purpose) return null;
  const form = fromTitle?.form || fromMeta?.form || detectForm(`${title} ${meta}`);
  return {
    name: requestedName.trim(),
    purpose,
    form,
    source: 'Farmatodo',
  };
}

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'text/html', 'User-Agent': 'LiaMedicationLookup/1.0' },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function lookupUncached(name: string): Promise<CommercialProduct | null> {
  const [cruz, farmatodo] = await Promise.all([
    fetchText(CATALOGS[0].url(name)),
    slug(name).length >= 3 ? fetchText(CATALOGS[1].url(name)) : Promise.resolve(null),
  ]);

  let formFromCatalog: string | null = null;
  if (cruz) {
    for (const label of labelsFromSuggestions(cruz)) {
      if (!sameProduct(name, label)) continue;
      formFromCatalog = formFromCatalog || detectForm(label);
      const found = purposeFromCatalogTitle(name, label);
      if (found) return { ...found, form: found.form || formFromCatalog, source: 'Cruz Verde' };
    }
  }
  if (farmatodo) {
    const found = fromFarmatodo(farmatodo, name);
    if (found) return { ...found, form: found.form || formFromCatalog, source: 'Farmatodo' };
  }
  return null;
}

export async function lookupCommercialCatalog(name: string): Promise<CommercialProduct | null> {
  const key = fold(name);
  if (!key || key.length < 3) return null;
  if (CACHE.has(key)) return CACHE.get(key) ?? null;
  const found = await lookupUncached(name.trim());
  CACHE.set(key, found);
  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[commercial-catalog] name=${name.trim()} found=${found ? 'yes' : 'no'} source=${found?.source ?? '-'} form=${found?.form ?? '-'}`
    );
  }
  return found;
}
