import { ObservedIngredient, ObservedPackage } from '../models/types';
import { foldAccents } from '../utils/externalHttp';

/**
 * Instrucción de la única llamada de visión de la cámara del celular.
 * La cámara física no la usa.
 */
export const MOBILE_PACKAGE_VISION_INSTRUCTION = `Eres un asistente que lee el empaque de un medicamento en una foto.
Responde SIEMPRE en español y SOLO con JSON válido de esta forma:
{"name":"nombre comercial visible o cadena vacía","identified":true o false,"observedPackage":{"ingredients":[{"name":"principio activo tal como se lee","strength":"concentración de ese componente o null"}],"presentation":"tabletas, cápsulas u otra forma visible, o null","route":"vía visible, o null","manufacturer":"fabricante visible, o null","sanitaryRegistry":"registro sanitario visible, o null"}}
Reglas:
- Copia solo lo que se lee en la foto. Si un dato no se lee, usa null.
- No inventes principios activos, concentraciones, usos ni precauciones.
- No expliques para qué sirve el medicamento.
- No corrijas el nombre comercial hacia otro parecido. Nalixone no es naloxona.
- No completes una formulación que el empaque no muestra.
- Si hay varios principios activos, inclúyelos todos, cada uno con su concentración si está escrita.
- identified=true solo si se lee con claridad el nombre comercial o un principio activo.`;

export const MOBILE_PACKAGE_VISION_USER_TEXT =
  'Lee el empaque de esta foto. Devuelve el nombre comercial y, si se ven, los principios activos, sus concentraciones, la presentación, la vía, el fabricante y el registro sanitario. Solo JSON.';

const WEAK_NAME_TOKENS = new Set([
  'extra',
  'fuerte',
  'forte',
  'plus',
  'max',
  'maxi',
  'kids',
  'adulto',
  'adult',
  'ultra',
  'super',
  'dual',
  'rapid',
  'rapido',
  'noche',
  'dia',
  'night',
  'day',
  'mega',
  'junior',
  'baby',
  'infantil',
  'forte',
]);

type IngredientIdentity = {
  keys: string[];
  lookup: string;
  display: string;
};

/** Nombres que RxNorm guarda en inglés y el empaque muestra en español. */
const INGREDIENT_IDENTITIES: IngredientIdentity[] = [
  {
    keys: ['acetaminofen', 'acetaminophen', 'paracetamol'],
    lookup: 'acetaminophen',
    display: 'acetaminofén',
  },
  {
    keys: ['ibuprofeno', 'ibuprofen'],
    lookup: 'ibuprofen',
    display: 'ibuprofeno',
  },
  {
    keys: ['cafeina', 'caffeine'],
    lookup: 'caffeine',
    display: 'cafeína',
  },
  {
    keys: ['acido nalidixico', 'nalidixic acid'],
    lookup: 'nalidixic acid',
    display: 'ácido nalidíxico',
  },
  {
    keys: ['fenazopiridina', 'phenazopyridine'],
    lookup: 'phenazopyridine',
    display: 'fenazopiridina',
  },
  {
    keys: ['nitrofurantoina', 'nitrofurantoin'],
    lookup: 'nitrofurantoin',
    display: 'nitrofurantoína',
  },
];

const SALT_WORDS =
  /\b(clorhidrato|hydrochloride|succinate|tartrate|sodium|sodio|sodica|sodico|potassium|potasica|potasico|calcica|calcico|magnesica|magnesico|maleate|fumarate|mesylate|besylate|sulfate|sulphate|acetate|citrate|phosphate|bitartrate)\b/g;

export function foldLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function cleanIngredientLabel(value: string): string {
  return foldLabel(value).replace(SALT_WORDS, ' ').replace(/\s+/g, ' ').trim();
}

function identityKeyMatches(key: string, known: string): boolean {
  if (key === known) return true;
  return ` ${key} `.includes(` ${known} `);
}

export function ingredientIdentity(value: string): IngredientIdentity | null {
  const key = cleanIngredientLabel(value);
  if (!key) return null;
  return INGREDIENT_IDENTITIES.find((item) => item.keys.some((known) => identityKeyMatches(key, known))) || null;
}

const FORM_WORD =
  /^(tabletas?|capsulas?|comprimidos?|grageas?|recubiertas?|caja|frasco|sobre|oral|solucion|mg|ml)$/;

function meaningfulTokens(value: string): string[] {
  return foldLabel(value)
    .split(' ')
    .filter((token) => token.length >= 4 && !FORM_WORD.test(token));
}

function tokenIsCovered(token: string, pieces: string[]): boolean {
  if (pieces.includes(token)) return true;
  let rest = token;
  const ordered = [...pieces].sort((left, right) => right.length - left.length);
  for (const piece of ordered) {
    if (!rest.includes(piece)) continue;
    rest = rest.replace(piece, '');
  }
  return rest.length === 0;
}

/**
 * El nombre comercial completo tiene que ser el de la ficha.
 * «Sevedol Extra Fuerte» no acepta «Sevedol» ni «Sevedol Tense».
 * «Extrafuerte» sí corresponde a «extra» + «fuerte».
 */
export function commercialNameAgrees(requestedName: string, title: string): boolean {
  const requestedTokens = meaningfulTokens(requestedName);
  const titleTokens = meaningfulTokens(title);
  if (requestedTokens.length === 0 || titleTokens.length === 0) return false;
  const requestedCovered = requestedTokens.every((token) =>
    titleTokens.some((titleToken) => titleToken === token || titleToken.includes(token))
  );
  if (!requestedCovered) return false;
  return titleTokens.every((titleToken) => tokenIsCovered(titleToken, requestedTokens));
}

/** Quita la sal para buscar el principio activo, sin borrar el nombre del medicamento. */
export function withoutSalt(value: string): string {
  return foldLabel(value)
    .replace(SALT_WORDS, ' ')
    .replace(/\bde\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Sigla corta o token con cifra, como B12. Un nombre en mayúsculas no es una sigla. */
function keepIngredientToken(token: string): boolean {
  const bare = token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  if (!bare) return false;
  if (/\d/.test(bare) && bare.length <= 6) return true;
  return /^[\p{Lu}]{2,4}$/u.test(bare);
}

export function displayIngredientName(observedName: string, canonicalName?: string | null): string {
  const fromObserved = ingredientIdentity(observedName);
  if (fromObserved) return fromObserved.display;
  const fromCanonical = canonicalName ? ingredientIdentity(canonicalName) : null;
  if (fromCanonical) return fromCanonical.display;
  return observedName
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((token) => (keepIngredientToken(token) ? token : token.toLocaleLowerCase('es')))
    .join(' ');
}

export function spanishGenericName(value: string | null | undefined): string | null {
  const cleaned = value?.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  const identity = ingredientIdentity(cleaned);
  return identity ? identity.display : cleaned;
}

/** Nalixone no se acepta como si fuera naloxona. */
export function rejectsConfusedDrug(observedName: string, canonicalName: string): boolean {
  const observed = cleanIngredientLabel(observedName).replace(/ /g, '');
  const canonical = cleanIngredientLabel(canonicalName).replace(/ /g, '');
  return observed === 'nalixone' && canonical === 'naloxone';
}

export function normalizeStrength(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/(\d+(?:[.,]\d+)?)\s*(mg|g|mcg|µg|ug|ml|ui|%)/i);
  if (!match) return null;
  const amount = match[1].replace(',', '.');
  const unit = match[2].toLowerCase() === 'ug' || match[2] === 'µg' ? 'mcg' : match[2].toLowerCase();
  return `${amount} ${unit}`;
}

function nullableText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned || /^null$/i.test(cleaned)) return null;
  return cleaned.slice(0, max);
}

export function parseObservedPackage(raw: unknown): ObservedPackage | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as {
    ingredients?: unknown;
    presentation?: unknown;
    route?: unknown;
    manufacturer?: unknown;
    sanitaryRegistry?: unknown;
  };
  const ingredients: ObservedIngredient[] = [];
  if (Array.isArray(record.ingredients)) {
    for (const item of record.ingredients) {
      if (!item || typeof item !== 'object') continue;
      const name = nullableText((item as { name?: unknown }).name, 80);
      if (!name) continue;
      ingredients.push({
        name,
        strength: normalizeStrength(nullableText((item as { strength?: unknown }).strength, 40)),
      });
      if (ingredients.length >= 6) break;
    }
  }
  const parsed: ObservedPackage = {
    ingredients,
    presentation: normalizePresentation(nullableText(record.presentation, 80)),
    route: normalizeRoute(nullableText(record.route, 40)),
    manufacturer: nullableText(record.manufacturer, 80),
    sanitaryRegistry: nullableText(record.sanitaryRegistry, 40),
  };
  if (
    parsed.ingredients.length === 0 &&
    !parsed.presentation &&
    !parsed.route &&
    !parsed.manufacturer &&
    !parsed.sanitaryRegistry
  ) {
    return null;
  }
  return parsed;
}

export function normalizePresentation(value: string | null): string | null {
  if (!value) return null;
  const text = foldLabel(value);
  if (/capsulas?/.test(text)) return 'cápsulas';
  if (/tabletas?|comprimidos?|grageas?/.test(text)) return 'tabletas';
  if (/jarabe/.test(text)) return 'jarabe';
  if (/suspension/.test(text)) return 'suspensión';
  if (/gotas?/.test(text)) return 'gotas';
  if (/crema/.test(text)) return 'crema';
  if (/solucion/.test(text)) return 'solución';
  return null;
}

export function normalizeRoute(value: string | null): string | null {
  if (!value) return null;
  const text = foldLabel(value);
  if (/oral|boca/.test(text)) return 'oral';
  if (/topica|piel/.test(text)) return 'tópica';
  if (/oftalm/.test(text)) return 'oftálmica';
  return null;
}

export function presentationFamily(value: string | null): string | null {
  const presentation = normalizePresentation(value);
  if (!presentation) return null;
  if (presentation === 'tabletas') return 'tablet';
  if (presentation === 'cápsulas') return 'capsule';
  return presentation;
}

export function presentationsAgree(left: string | null, right: string | null): boolean {
  if (!left || !right) return false;
  const a = presentationFamily(left);
  const b = presentationFamily(right);
  return Boolean(a && b && a === b);
}

export function strengthsAgree(left: string | null, right: string | null): boolean {
  const a = normalizeStrength(left);
  const b = normalizeStrength(right);
  return Boolean(a && b && a === b);
}

/** Mismo nombre escrito, o uno de los seis sinónimos explícitos. La escritura parecida no alcanza. */
export function sameIngredient(left: string, right: string): boolean {
  const a = ingredientIdentity(left);
  const b = ingredientIdentity(right);
  if (a && b) return a.lookup === b.lookup;
  if (rejectsConfusedDrug(left, right) || rejectsConfusedDrug(right, left)) return false;
  const observed = cleanIngredientLabel(left);
  const other = cleanIngredientLabel(right);
  if (observed && other && observed === other) return true;
  return false;
}

export type ListedIngredient = {
  name: string;
  strength: string | null;
};

/**
 * Una ficha pública solo respalda el empaque si trae los mismos componentes,
 * las mismas concentraciones y una presentación compatible.
 */
export function sameFormulation(
  observed: ObservedPackage,
  listed: { ingredients: ListedIngredient[]; presentation: string | null }
): boolean {
  if (observed.ingredients.length < 2 || listed.ingredients.length !== observed.ingredients.length) {
    return false;
  }
  if (!presentationsAgree(observed.presentation, listed.presentation)) return false;
  const pending = [...listed.ingredients];
  for (const ingredient of observed.ingredients) {
    if (!ingredient.strength) return false;
    const index = pending.findIndex(
      (item) => sameIngredient(ingredient.name, item.name) && strengthsAgree(ingredient.strength, item.strength)
    );
    if (index < 0) return false;
    pending.splice(index, 1);
  }
  return pending.length === 0;
}

export function formatIngredientList(ingredients: Array<{ name: string; strength: string | null }>): string {
  const parts = ingredients
    .map((item) => [item.name.trim(), item.strength?.trim()].filter(Boolean).join(' '))
    .filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} y ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}

export function ingredientNamesInText(text: string): string[] {
  const folded = ` ${foldLabel(text)} `;
  const found: string[] = [];
  for (const identity of INGREDIENT_IDENTITIES) {
    if (identity.keys.some((key) => folded.includes(` ${key} `) || folded.includes(key.replace(/ /g, '')))) {
      found.push(identity.display);
    }
  }
  return found;
}

function groupedStrengths(strengthText: string, count: number): Array<string | null> {
  const grouped = strengthText.match(
    /\(?(\d+(?:[.,]\d+)?(?:\s*\+\s*\d+(?:[.,]\d+)?)*)\)?\s*(mg|g|mcg|µg|ug|ml|ui|%)/i
  );
  if (!grouped) return [];
  const amounts = grouped[1].split(/\s*\+\s*/);
  if (amounts.length !== count) return [];
  const unit = grouped[2].toLowerCase() === 'ug' || grouped[2] === 'µg' ? 'mcg' : grouped[2].toLowerCase();
  return amounts.map((amount) => normalizeStrength(`${amount} ${unit}`));
}

function pairPlusList(ingredientsText: string, strengthText: string | null): ListedIngredient[] {
  const names = ingredientsText
    .split(/\+| y |,|\/|&/i)
    .map((part) => part.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((part) => {
      const folded = foldLabel(part);
      return (
        folded.length >= 4 &&
        !/principio activo|concentracion|composicion|presentacion|indicacion|registro/.test(folded)
      );
    });
  const limited = names.slice(0, 6);
  const grouped = strengthText ? groupedStrengths(strengthText, limited.length) : [];
  const individual = strengthText
    ? [...strengthText.matchAll(/(\d+(?:[.,]\d+)?)\s*(mg|g|mcg|µg|ug|ml|ui|%)/gi)].map((match) =>
        normalizeStrength(`${match[1]} ${match[2]}`)
      )
    : [];
  const strengths = grouped.length === limited.length ? grouped : individual;
  return limited.map((name, index) => ({
    name: (name.replace(/(\d+(?:[.,]\d+)?)\s*(mg|g|mcg|µg|ug|ml|ui|%)/i, '').replace(/[.:;,]+$/g, '').trim() ||
      name),
    strength: strengths.length === limited.length ? strengths[index] : normalizeStrength(name),
  }));
}

export function decodeListedHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/&uuml;/gi, 'ü')
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCharCode(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeListed(items: ListedIngredient[]): ListedIngredient[] {
  const kept: ListedIngredient[] = [];
  for (const item of items) {
    if (!item.strength || item.name.trim().length < 4) continue;
    const label = cleanIngredientLabel(item.name);
    if (!label) continue;
    if (kept.some((other) => cleanIngredientLabel(other.name) === label)) continue;
    kept.push(item);
  }
  return kept;
}

function ingredientsInRegion(region: string): ListedIngredient[] {
  const cleaned = region.replace(/\b[nN]\.?[fF]\.?/g, ' ').replace(/[.]{2,}/g, ' ');
  const found: ListedIngredient[] = [];
  const pattern =
    /([a-záéíóúüñ]{3,}(?:\s+[a-záéíóúüñ]{2,}){0,5})\s+(\d+(?:[.,]\d+)?)\s*(mg|g|mcg|ml)\b/gi;
  for (const match of cleaned.matchAll(pattern)) {
    const name = match[1].replace(/\s+/g, ' ').trim();
    if (/tableta|c[aá]psula|excipiente|presentaci|caja|frasco/i.test(name)) continue;
    const strength = normalizeStrength(`${match[2]} ${match[3]}`);
    if (!strength) continue;
    found.push({ name, strength });
  }
  return dedupeListed(found);
}

function doseLineIngredients(text: string): ListedIngredient[] {
  const starts = [
    ...text.matchAll(
      /(?:composici[oó]n|principio activo|cada\s+(?:tableta|c[aá]psula|comprimido)\s+contiene)/gi
    ),
  ];
  const regions = starts.length
    ? starts.map((match) => text.slice(match.index || 0, (match.index || 0) + 700))
    : [];
  let best: ListedIngredient[] = [];
  for (const region of regions) {
    const found = ingredientsInRegion(region);
    if (found.length > best.length) best = found;
  }
  return best;
}

/** Lee una ficha comercial ya descargada. No inventa componentes que el texto no trae. */
export function parseListedProduct(text: string, requestedName: string): {
  name: string;
  ingredients: ListedIngredient[];
  presentation: string | null;
  purpose: string | null;
  cautionText: string;
  source: string;
} | null {
  const plain = decodeListedHtml(text);
  if (!plain) return null;
  const composition = plain.match(
    /composici[oó]n:\s*cada\s+(tableta|c[aá]psula|comprimido)[^.]{0,40}contiene\s+([^.]{8,240})/i
  );
  const active = plain.match(
    /principio activo:\s*([\s\S]{3,160}?)(?=\s+concentraci[oó]n:|\s+presentaci[oó]n:|\s+indicaciones:|$)/i
  );
  const concentration = plain.match(/concentraci[oó]n:\s*([^.]{3,80})/i);
  const labeledPresentation =
    plain.match(/presentaci[oó]n:\s*([^.]{3,120})/i)?.[1] || composition?.[1] || null;
  const fromComposition = composition ? dedupeListed(pairPlusList(composition[2], composition[2])) : [];
  const fromActive = active ? dedupeListed(pairPlusList(active[1], concentration?.[1] || null)) : [];
  const fromLines = doseLineIngredients(plain);
  const ingredients =
    fromComposition.length >= 2
      ? fromComposition
      : fromActive.length >= 2
        ? fromActive
        : fromLines.length >= 2
          ? fromLines
          : fromComposition.length > 0
            ? fromComposition
            : fromActive.length > 0
              ? fromActive
              : fromLines;
  if (ingredients.length === 0) return null;
  return {
    name: requestedName.trim(),
    ingredients,
    presentation:
      normalizePresentation(labeledPresentation) || normalizePresentation(plain.slice(0, 900)),
    purpose: publishedIndication(plain),
    cautionText: plain,
    source: 'ficha pública',
  };
}

function publishedIndication(text: string): string | null {
  const patterns = [
    /(?<![a-záéíóúüñ])indicaciones(?:\s+terap[eé]uticas|\s+de\s+uso)?\s*:?\s*([^.]{8,280})/gi,
    /est[aá] indicado para\s+([^.]{8,280})/gi,
    /[uú]til en el tratamiento\s+([^.]{8,280})/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const line = (match[1] || '').replace(/\s+/g, ' ').trim();
      if (!line || /leer indicaciones|no exceder su consumo|uso indiscriminado/i.test(line)) continue;
      if (plainVerifiedPurpose(line)) return line;
    }
  }
  return null;
}

export function plainCombinationPurpose(sourcePurpose: string): string | null {
  const text = sourcePurpose.replace(/\s+/g, ' ').trim();
  if (!text || /bajo indicaci[oó]n m[eé]dica/i.test(text)) return null;
  const urinary = /infecci[oó]n(?:es)? urinaria|v[ií]as urinarias|tracto urinario/i.test(text);
  const discomfort = /dolor|ardor|molest/i.test(text);
  const analgesic = /analg[eé]sic/i.test(text);
  const fever = /antipir[eé]tic|fiebre/i.test(text);
  if (urinary && discomfort) {
    return 'Sirve para las infecciones de las vías urinarias y las molestias al orinar.';
  }
  if (urinary) return 'Sirve para las infecciones de las vías urinarias.';
  if (analgesic && fever) return 'Sirve para aliviar el dolor y bajar la fiebre.';
  if (analgesic) return 'Sirve para aliviar el dolor.';
  return null;
}

/**
 * Solo cuando la fuente dice las dos cosas: que sustituye la hormona
 * y que se usa para el hipotiroidismo.
 */
export function plainHormoneReplacement(sourcePurpose: string): string | null {
  const text = sourcePurpose.replace(/\s+/g, ' ').trim();
  const replaces = /sustitu|reemplaz/i.test(text);
  const hypo = /hipotiroidismo|no produce suficiente hormona/i.test(text);
  if (!replaces || !hypo) return null;
  return 'Sustituye la hormona de la tiroides. Sirve sobre todo para el hipotiroidismo, cuando la tiroides produce poca hormona.';
}

/**
 * Traduce la finalidad que sí está escrita en una fuente verificada.
 * Si el texto no dice para qué sirve, no completa la frase.
 */
export function plainVerifiedPurpose(sourcePurpose: string): string | null {
  const specific = plainCombinationPurpose(sourcePurpose);
  if (specific) return specific;
  const text = sourcePurpose.replace(/\s+/g, ' ').trim();
  if (!text || /bajo indicaci[oó]n m[eé]dica|leer indicaciones|no exceder su consumo|uso indiscriminado/i.test(text)) {
    return null;
  }
  const hormoneReplacement = plainHormoneReplacement(text);
  if (hormoneReplacement) return hormoneReplacement;
  if (/hipotiroidismo|hypothyroid/i.test(text)) {
    return 'Sirve para el hipotiroidismo, cuando la tiroides produce poca hormona.';
  }
  if (/hipertiroidismo|hyperthyroid/i.test(text)) {
    return 'Sirve para el hipertiroidismo, cuando la tiroides produce demasiada hormona.';
  }
  if (/presi[oó]n arterial alta|hipertensi[oó]n|hypertension|high blood pressure/i.test(text)) {
    return 'Sirve para bajar la presión alta.';
  }
  if (/\bdiabetes\b|az[uú]car en la sangre|blood sugar/i.test(text)) {
    return 'Sirve para controlar el azúcar en la sangre.';
  }
  if (/antibacteriano|antibi[oó]tico|bacterial infection/i.test(text) && !/urinari/i.test(text)) {
    return 'Sirve para algunas infecciones causadas por bacterias.';
  }
  if (/antihistam[ií]n|alergia|allergy/i.test(text)) return 'Sirve para la alergia.';
  if (/\basma\b|asthma|broncoespasmo/i.test(text)) return 'Sirve para facilitar la respiración.';
  if (/ojo seco|l[aá]grima|lubricante oft|higiene ocular|ophthalmic lubricant/i.test(text)) {
    return 'Sirve para humedecer o limpiar los ojos.';
  }
  if (/acidez|anti[aá]cido|heartburn/i.test(text)) return 'Sirve para la acidez del estómago.';
  const clause = text.match(
    /(?:indicad[oa]s? para|se usa para|used to|tratamiento de|treatment of)\s+([^.]{8,140})/i
  )?.[1];
  if (!clause || /\d+\s*(mg|g|mcg|ml|horas|tabletas|c[aá]psulas)/i.test(clause)) return null;
  if (/no est[aá] indicado|no debe|contraindicad|do not use/i.test(clause)) return null;
  const clean = clause.replace(/\s+/g, ' ').replace(/[;,:\s]+$/g, '').trim();
  if (clean.length < 8) return null;
  return `Sirve para ${clean.charAt(0).toLocaleLowerCase('es')}${clean.slice(1)}.`;
}

export function briefSourcePrecautions(text: string): string[] {
  const facts: string[] = [];
  if (/[uú]lcera|ulcer|sangrado gastrointestinal|gastrointestinal bleeding/i.test(text)) {
    facts.push('No lo tomes si tienes úlcera o sangrado del estómago.');
  }
  if (/hipersensibilidad|hypersensitivity|al[eé]rgic|allergic/i.test(text)) {
    facts.push('No lo tomes si eres alérgico a alguno de sus componentes.');
  }
  if (/embaraz|pregnan|lactancia|breast-?feeding/i.test(text)) {
    facts.push('Si estás embarazada o das pecho, consulta a tu médico.');
  }
  if (
    facts.length < 2 &&
    /insuficiencia hep[aá]tica|hepatic impairment|liver disease|problema[s]? del h[ií]gado|h[ií]gado/i.test(text)
  ) {
    facts.push('Si tienes problemas del hígado, consulta antes de tomarlo.');
  }
  return facts.slice(0, 4);
}

function parenthesesBalanced(text: string): boolean {
  let depth = 0;
  for (const char of text) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function closeClause(text: string): string {
  let piece = text.replace(/[\s,;:]+$/g, '').trim();
  if (!parenthesesBalanced(piece)) {
    const open = piece.lastIndexOf('(');
    if (open > 20) piece = piece.slice(0, open).replace(/[\s,;:]+$/g, '').trim();
  }
  if (!piece) return '';
  return /[.!?]$/.test(piece) ? piece : `${piece}.`;
}

const SHEET_HEADING =
  /^(?:precauciones|advertencias|contraindicaciones|interacciones|reacciones adversas|efectos adversos|efectos secundarios)(?:\s+y\s+(?:precauciones|advertencias|contraindicaciones|interacciones))*\s*:?\s*/i;

type PlainWarning = { key: string; rank: number; text: string };

function peelHeadings(value: string): string {
  let rest = value.replace(/\s+/g, ' ').trim();
  while (SHEET_HEADING.test(rest)) rest = rest.replace(SHEET_HEADING, '').trim();
  return rest;
}

function warningFold(value: string): string {
  return foldAccents(value).toLowerCase();
}

function hasWarningVerb(value: string): boolean {
  return /\b(?:no\s+(?:lo|la|los|las|se)?\s*(?:tome|tomes|use|uses|administre|administrar|debe)|informe|consulte|puede|pueden|incrementa|aumenta|produc(?:e|en|ir)|recomend|evite|llame)\b/i.test(
    value
  );
}

function cleanPunctuation(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\.+\s*;+\s*\.*/g, '.')
    .replace(/;+\s*\.+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/[;,]+\s*$/g, '')
    .trim();
}

function tidyWarning(value: string): string {
  const text = cleanPunctuation(value)
    .replace(/\bNo tome\b/g, 'No tomes')
    .replace(/\bno tome\b/g, 'no tomes')
    .replace(/\bNo lo tome\b/gi, 'No lo tomes')
    .replace(/\bNo use\b/gi, 'No uses')
    .replace(/\bInforme a su m[eé]dico\b/gi, 'Cuéntale a tu médico')
    .replace(/\bsi est[aá] embarazada\b/gi, 'si estás embarazada')
    .replace(/\bsi tiene\b/gi, 'si tienes')
    .trim();
  if (!text || isDanglingList(text)) return '';
  const spoken = text.charAt(0).toLocaleUpperCase('es') + text.slice(1);
  return /[.!?]$/.test(spoken) ? spoken : `${spoken}.`;
}

/** Una introducción que promete una lista y no la trae. */
function isDanglingList(value: string): boolean {
  if (/:\s*$/.test(value)) return true;
  if (/cualquiera de estos s[ií]ntomas|siguientes s[ií]ntomas|se vuelve severo o si no desaparece/i.test(value)) {
    const after = value.split(':').slice(1).join(':').trim();
    return after.length < 12;
  }
  return false;
}

function listSentence(parts: string[]): string {
  if (parts.length <= 1) return parts[0] || '';
  return `${parts.slice(0, -1).join(', ')} o ${parts[parts.length - 1]}`;
}

function warningKey(value: string): string {
  const text = warningFold(value);
  if (/semana|trimestre|feto|bebe|parto/.test(text) && /embaraz/.test(text)) return 'embarazo-especifico';
  if (/embaraz|lactancia|pecho/.test(text)) return 'embarazo';
  if (/aspirina|acetil/.test(text) && /ulcera|sangrad/.test(text)) return 'aspirina-ulcera';
  if (/ulceras, hemorragias|ulcera, sangrado o una perforacion|provocar ulceras/.test(text)) return 'ulcera-riesgo';
  if (/ulcera|sangrado gastrointestinal|acido peptic/.test(text)) return 'ulcera';
  if (/severa|grave/.test(text) && /higado|hepatic/.test(text)) return 'higado-grave';
  if (/higado|hepatic/.test(text)) return 'higado';
  if (/renal|rinon/.test(text)) return 'rinon';
  if (/ataque cardiaco recientemente|infarto hace poco/.test(text)) return 'infarto-reciente';
  if (/ataque cardiaco|infarto|derrame cerebral/.test(text)) return 'corazon';
  if (/cafeina/.test(text)) return 'cafeina';
  if (/mismo componente|mismos ingredientes|tomados juntos/.test(text)) return 'duplicado';
  if (/alerg|hipersensib/.test(text)) return 'alergia';
  if (/broncoespasmo|polipos|angioneurotico/.test(text)) return 'via-aerea';
  return text.slice(0, 48);
}

/** Fragmento sin verbo: solo se convierte si el texto ya dice la condición. */
function warningFromFragment(fragment: string): PlainWarning | null {
  const clean = peelHeadings(fragment).replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length < 8 || clean.length > 320) return null;
  if (looksLikePersonalDose(clean)) return null;
  if (/iniciar sesion|acceso exclusivo|enciclopedia/i.test(warningFold(clean))) return null;
  const folded = warningFold(clean);
  if (!hasWarningVerb(clean)) {
    if (/ulcera|sangrado gastrointestinal|acido peptic/.test(folded)) {
      const parts = [
        /ulcera/.test(folded) ? 'úlcera' : '',
        /sangrado gastrointestinal/.test(folded) ? 'sangrado del estómago' : '',
        /acido peptic/.test(folded) ? 'antecedente de enfermedad por ácido' : '',
      ].filter(Boolean);
      return { key: 'ulcera', rank: 2, text: `No lo tomes si tienes ${listSentence(parts)}.` };
    }
    if (/hipersensib|alerg/.test(folded)) {
      const nsaid = /aspirina|acetil|aine/.test(folded);
      const components = /principio|componente|excipiente/.test(folded);
      const text =
        nsaid && components
          ? 'No lo tomes si eres alérgico a sus componentes, a la aspirina o a otros antiinflamatorios.'
          : nsaid
            ? 'No lo tomes si has tenido alergia a la aspirina o a otros antiinflamatorios.'
            : 'No lo tomes si eres alérgico a alguno de sus componentes.';
      return { key: 'alergia', rank: 1, text };
    }
    if (/broncoespasmo|rinitis|polipos|angioneurotico/.test(folded)) {
      const parts = [
        /broncoespasmo/.test(folded) ? 'broncoespasmo' : '',
        /rinitis/.test(folded) ? 'rinitis' : '',
        /polipos/.test(folded) ? 'pólipos nasales' : '',
        /angioneurotico/.test(folded) ? 'hinchazón alérgica' : '',
      ].filter(Boolean);
      return { key: 'via-aerea', rank: 5, text: `No lo tomes si has tenido ${listSentence(parts)}.` };
    }
    if (/hepatic/.test(folded) && /severa|grave/.test(folded)) {
      return { key: 'higado-grave', rank: 2, text: 'No lo tomes si tienes una enfermedad grave del hígado.' };
    }
    if (/renal/.test(folded) && /grave/.test(folded)) {
      return { key: 'rinon', rank: 2, text: 'No lo tomes si tienes un problema grave de los riñones.' };
    }
    if (/hepatic|higado|renal|rinon/.test(folded)) {
      const liver = /hepatic|higado/.test(folded);
      const kidney = /renal|rinon/.test(folded);
      return {
        key: liver ? 'higado' : 'rinon',
        rank: 4,
        text:
          liver && kidney
            ? 'Cuéntale a tu médico si tienes problemas del hígado o de los riñones.'
            : liver
              ? 'Cuéntale a tu médico si tienes problemas del hígado.'
              : 'Cuéntale a tu médico si tienes problemas de los riñones.',
      };
    }
    if (/embaraz/.test(folded) || /lactancia/.test(folded)) {
      const trimester = /tercer trimestre/.test(folded);
      const nursing = /lactancia|pecho/.test(folded);
      const text =
        trimester && nursing
          ? 'Ten especial cuidado en el tercer trimestre del embarazo y si das pecho.'
          : trimester
            ? 'Ten especial cuidado en el tercer trimestre del embarazo.'
            : nursing
              ? 'Ten especial cuidado si das pecho.'
              : '';
      return text ? { key: 'embarazo-especifico', rank: 3, text } : null;
    }
    return null;
  }
  if ((clean.match(/,/g) || []).length >= 4 && !/\bno (?:lo |la )?tom/i.test(clean)) return null;
  if (/aspirina|acetil/.test(folded) && /ulcera|sangrad/.test(folded) && /incrementa|aumenta|riesgo/.test(folded)) {
    return {
      key: 'aspirina-ulcera',
      rank: 4,
      text: 'Usarlo junto con aspirina aumenta el riesgo de úlcera en el estómago.',
    };
  }
  if (/cafeina/.test(folded) && /insomnio|nauseas/.test(folded)) {
    return {
      key: 'cafeina',
      rank: 6,
      text: /nauseas/.test(folded)
        ? 'La cafeína de este producto puede quitarte el sueño o causarte náuseas.'
        : 'La cafeína de este producto puede quitarte el sueño.',
    };
  }
  const text = tidyWarning(clean);
  if (
    !text ||
    isDanglingList(text) ||
    /[.][;]|[;][.]/.test(text) ||
    !/no tom|al[eé]rg|embaraz|h[ií]gado|ri[nñ][oó]n|sangrad|[uú]lcera|infarto|derrame|asma|glaucoma|mismo componente|reacci[oó]n grave|informe|cu[eé]ntale|otro analg[eé]sico/i.test(
      text
    )
  ) {
    return null;
  }
  const key = warningKey(text);
  const rank = key === 'alergia' ? 1 : key === 'ulcera' || key === 'higado-grave' || key === 'rinon' ? 2 : 4;
  return { key, rank, text };
}

function mergeNamed(items: PlainWarning[], key: string, textFor: (blob: string) => string | null): PlainWarning[] {
  const family = items.filter((item) => item.key === key);
  if (family.length <= 1) return items;
  const text = textFor(warningFold(family.map((item) => item.text).join(' ')));
  if (!text) return items;
  return [{ key, rank: family[0].rank, text }, ...items.filter((item) => item.key !== key)];
}

function preferWarnings(items: PlainWarning[]): string[] {
  const mergedAllergy = mergeNamed(items, 'alergia', (blob) => {
    const nsaid = /aspirina|antiinflamatorio/.test(blob);
    const components = /componente/.test(blob);
    if (nsaid && components) return 'No lo tomes si eres alérgico a sus componentes, a la aspirina o a otros antiinflamatorios.';
    return null;
  });
  const mergedAirway = mergeNamed(mergedAllergy, 'via-aerea', (blob) => {
    const parts = [
      /broncoespasmo/.test(blob) ? 'broncoespasmo' : '',
      /rinitis/.test(blob) ? 'rinitis' : '',
      /polipos/.test(blob) ? 'pólipos nasales' : '',
      /hinchazon/.test(blob) ? 'hinchazón alérgica' : '',
    ].filter(Boolean);
    return parts.length > 1 ? `No lo tomes si has tenido ${listSentence(parts)}.` : null;
  });
  const week = mergedAirway.filter((item) => item.key === 'embarazo-especifico' && /20/.test(item.text));
  let next = mergedAirway;
  if (week.length >= 2) {
    const blob = warningFold(week.map((item) => item.text).join(' '));
    const merged =
      /dan|parto|feto|bebe/.test(blob) && /no tom/.test(blob)
        ? 'A partir de las 20 semanas de embarazo puede hacerle daño al bebé y causar problemas en el parto. No lo tomes en esa etapa, salvo que tu médico lo indique.'
        : week.slice().sort((left, right) => right.text.length - left.text.length)[0].text;
    next = [
      { key: 'embarazo-especifico', rank: 3, text: merged },
      ...mergedAirway.filter((item) => item.key !== 'embarazo-especifico' || !/20/.test(item.text)),
    ];
  }
  const byKey = new Map<string, PlainWarning>();
  for (const item of next) {
    const current = byKey.get(item.key);
    if (!current || item.rank < current.rank) byKey.set(item.key, item);
  }
  let chosen = [...byKey.values()];
  if (chosen.some((item) => item.key === 'embarazo-especifico')) {
    chosen = chosen.filter((item) => item.key !== 'embarazo');
  }
  if (chosen.some((item) => item.key === 'higado-grave')) chosen = chosen.filter((item) => item.key !== 'higado');
  if (chosen.some((item) => item.rank <= 2)) {
    chosen = chosen.filter((item) => !/qu[eé] medicamentos con y sin receta|lista de los ingredientes|65 a[nñ]os o m[aá]s|fertilidad/i.test(item.text));
  }
  chosen.sort((left, right) => left.rank - right.rank);
  const critical = chosen.filter((item) => item.rank <= 2);
  const rest = chosen.filter((item) => item.rank > 2);
  return [...critical, ...rest.slice(0, Math.max(0, 6 - critical.length))].slice(0, 8).map((item) => item.text);
}

function documentedRisks(text: string): PlainWarning[] {
  const folded = warningFold(text);
  const found: PlainWarning[] = [];
  if (/ataque cardiaco|infarto|derrame cerebral/.test(folded)) {
    found.push({
      key: 'corazon',
      rank: 1,
      text: 'Puede aumentar el riesgo de infarto o derrame cerebral.',
    });
  }
  if (/ataque cardiaco recientemente/.test(folded) && /a menos que|salvo que|se lo indique/.test(folded)) {
    found.push({
      key: 'infarto-reciente',
      rank: 1,
      text: 'No lo uses si tuviste un infarto hace poco, salvo que tu médico lo indique.',
    });
  }
  if (/ulceras|hemorragia|perforacion/.test(folded) && /estomago|intestino|esofago/.test(folded)) {
    found.push({
      key: 'ulcera-riesgo',
      rank: 1,
      text: 'Puede causar úlcera, sangrado o una perforación en el estómago o el intestino.',
    });
  }
  if (/dolor de pecho/.test(folded) && /dificultad para respirar/.test(folded) && /dificultad para hablar|debilidad en una parte/.test(folded)) {
    found.push({
      key: 'alarma-corazon',
      rank: 2,
      text: 'Busca ayuda de inmediato si tienes dolor de pecho, dificultad para respirar, debilidad de un lado del cuerpo o dificultad para hablar.',
    });
  }
  const sentences = folded.split(/\n+|(?<=\.)\s+/);
  const tells = (pattern: RegExp) =>
    sentences.some((sentence) => /informe a su medico si/.test(sentence) && pattern.test(sentence));
  if (tells(/enfermedad renal|insuficiencia renal/) && !/renal grave/.test(folded)) {
    found.push({
      key: 'rinon',
      rank: 2,
      text: 'Cuéntale a tu médico si tienes una enfermedad de los riñones.',
    });
  }
  if (tells(/insuficiencia cardiaca/)) {
    found.push({
      key: 'insuficiencia-cardiaca',
      rank: 2,
      text: 'Cuéntale a tu médico si tienes insuficiencia cardíaca.',
    });
  }
  return found;
}

/** Frases completas y sencillas. No copia cantidades de otra marca ni encabezados de la ficha. */
export function selectImportantWarnings(text: string): string[] {
  const prepared = cleanPunctuation(replaceKnownEnglishNames(text));
  const found = documentedRisks(prepared);
  for (const chunk of prepared.split(/\n+|(?<=\.)\s+/)) {
    const warning = warningFromFragment(chunk.trim());
    if (warning && !isDanglingList(warning.text)) found.push(warning);
  }
  return preferWarnings(found);
}

/**
 * Primera explicación de una monografía larga: para qué sirve, sin las definiciones
 * de cada enfermedad. Una finalidad ya breve se deja igual.
 */
export function briefMonographPurpose(text: string): string | null {
  const source = text.replace(/\s+/g, ' ').trim();
  if (!source || !/\([^)]{12,}\)/.test(source)) return null;
  const stripped = cleanPunctuation(source.replace(/\s*\([^)]*\)/g, ' '));
  const sentences = stripped
    .split(/(?<=\.)\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 20 && !part.startsWith('¿'));
  if (sentences.length === 0) return null;
  const first = leadPurpose(sentences[0]);
  const extra = sentences
    .slice(1)
    .find((part) => /fiebre|infecci[oó]n/.test(part) && !namesAnotherPresentation(part));
  if (!extra) return first;
  const second = compressClause(extra, 180);
  if (warningFold(second) === warningFold(first)) return first;
  const combined = `${first} ${second}`.replace(/\s+/g, ' ').trim();
  return combined.length <= 420 ? combined : first;
}

function namesAnotherPresentation(sentence: string): boolean {
  return /venta libre|liberaci[oó]n prolongada|suspensi[oó]n|tabletas|c[aá]psulas/i.test(sentence);
}

function leadPurpose(sentence: string): string {
  const withoutForm = sentence
    .replace(/\b(recetad[oa]s?|de venta libre)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const lead = withoutForm.split(/\s+causad[oa]s?\s+por\b|\s+ocasionad[oa]s?\s+por\b|\s+provocad[oa]s?\s+por\b/i)[0] || withoutForm;
  const spoken = closeClause(lead.replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').trim());
  return spoken.length >= 24 ? spoken : compressClause(sentence, 180);
}

function compressClause(sentence: string, max: number): string {
  const clean = cleanPunctuation(sentence);
  if (clean.length <= max && parenthesesBalanced(clean)) return closeClause(clean);
  const slice = clean.slice(0, max);
  const end = Math.max(slice.lastIndexOf(', '), slice.lastIndexOf(' y '), slice.lastIndexOf('; '));
  return closeClause(end > 60 ? slice.slice(0, end) : slice);
}

export function replaceKnownEnglishNames(text: string): string {
  return text
    .replace(/\bacetaminophen\b/gi, 'acetaminofén')
    .replace(/\bibuprofen\b/gi, 'ibuprofeno')
    .replace(/\bcaffeine\b/gi, 'cafeína')
    .replace(/\bnalidixic acid\b/gi, 'ácido nalidíxico')
    .replace(/\bphenazopyridine\b/gi, 'fenazopiridina')
    .replace(/\bnitrofurantoin\b/gi, 'nitrofurantoína');
}

export function looksLikePersonalDose(text: string): boolean {
  return /\d+\s*(g|mg|ml|tabletas|c[aá]psulas|horas)\b|dosis m[aá]xima|debes tomar|toma \d|no tomes m[aá]s de \d/i.test(
    text
  );
}

export function briefPatientLines(lines: string[]): string[] {
  const kept: string[] = [];
  let sawDoseLimit = false;
  for (const line of lines) {
    const clean = replaceKnownEnglishNames(line).replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    if (looksLikePersonalDose(clean)) {
      sawDoseLimit = true;
      continue;
    }
    if (clean.length > 240) continue;
    kept.push(clean);
  }
  if (sawDoseLimit) {
    kept.unshift('No tomes más de lo que indica el empaque o tu médico.');
  }
  const unique: string[] = [];
  for (const line of kept) {
    if (!unique.includes(line)) unique.push(line);
  }
  return unique.slice(0, 8);
}

export function shortenPurpose(text: string): string {
  const clean = replaceKnownEnglishNames(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= 420 && parenthesesBalanced(clean)) return closeClause(clean);
  const slice = clean.slice(0, 420);
  const end = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('; '));
  return closeClause(end > 80 ? slice.slice(0, end + 1) : slice);
}

export function distinctiveNameTokens(name: string): string[] {
  return foldLabel(name)
    .split(' ')
    .filter((token) => token.length >= 4 && !WEAK_NAME_TOKENS.has(token) && !/^\d+$/.test(token));
}

export function singleIngredientInName(name: string): IngredientIdentity | null {
  const tokens = foldLabel(name).split(' ').filter(Boolean);
  const found = INGREDIENT_IDENTITIES.filter((identity) =>
    identity.keys.some((key) => {
      const keyTokens = key.split(' ');
      if (keyTokens.length === 1) return tokens.includes(keyTokens[0]);
      return foldLabel(name).includes(key);
    })
  );
  const unique = [...new Set(found.map((item) => item.lookup))];
  if (unique.length !== 1) return null;
  return found[0];
}

export function joinPresentation(presentation: string | null, route: string | null): string | null {
  if (presentation && route) return `${presentation} por vía ${route}`;
  return presentation || (route ? `vía ${route}` : null);
}
