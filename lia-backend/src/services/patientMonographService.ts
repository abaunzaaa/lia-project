import { fetchJson, fetchText, foldAccents } from '../utils/externalHttp';
import { medicationSourceAgrees } from './drugChatService';

const RXNORM_CODE_SYSTEM = '2.16.840.1.113883.6.88';

export type PatientMonograph = {
  url: string;
  drugName: string;
  purpose: string;
  administration: string;
  precautions: string;
  adverse: string;
};

const monographCache = new Map<string, PatientMonograph | null>();

function foldName(value: string): string {
  return foldAccents(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCharCode(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

function plainText(html: string): string {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<li[^>]*>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function sectionText(html: string, sectionId: string): string {
  const at = html.indexOf(`id="${sectionId}"`);
  if (at < 0) return '';
  const bodyAt = html.indexOf('class="section-body"', at);
  if (bodyAt < 0 || bodyAt - at > 6000) return '';
  const open = html.indexOf('>', bodyAt);
  const end = html.indexOf('</section>', open);
  if (open < 0 || end < 0) return '';
  return plainText(html.slice(open + 1, end));
}

function sentencesOf(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=\.)\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 20);
}

function bulletsOf(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 20);
}

function firstSentence(text: string, maxChars = 280): string {
  const sentence = (sentencesOf(text)[0] || text.trim()).replace(/\s*\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim();
  const cut = sentence.length > maxChars ? `${sentence.slice(0, maxChars - 1).trimEnd()}…` : sentence;
  return cut.charAt(0).toUpperCase() + cut.slice(1);
}

function pageAgrees(html: string, drugName: string, purpose: string): boolean {
  const title = plainText((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '').split(':')[0] || '';
  const label = title || purpose.slice(0, 80);
  return medicationSourceAgrees(drugName, {
    name: label,
    genericName: label,
    brandNames: [],
  });
}

function monographUrlFromConnect(payload: unknown): string | null {
  const found: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      if (/medlineplus\.gov\/spanish\/druginfo\/meds\/[a-z0-9]+-es\.html/i.test(node)) found.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === 'object') Object.values(node).forEach(walk);
  };
  walk(payload);
  const url = found[0];
  if (!url) return null;
  return url.split('?')[0];
}

/** Lee la monografía en español y se queda solo con las secciones del medicamento. */
export function parseSpanishMonograph(
  html: string,
  drugName: string,
  url: string
): PatientMonograph | null {
  const purpose = sectionText(html, 'why');
  const administration = sectionText(html, 'how');
  const precautions = sectionText(html, 'precautions');
  const adverse = sectionText(html, 'side-effects');
  if (!purpose && !administration && !precautions && !adverse) return null;
  if (!pageAgrees(html, drugName, purpose)) return null;
  return {
    url,
    drugName: drugName.trim(),
    purpose,
    administration,
    precautions,
    adverse,
  };
}

async function exactRxcuis(drugName: string): Promise<string[]> {
  const data = await fetchJson<{ idGroup?: { rxnormId?: string[] } }>(
    `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(foldAccents(drugName).trim())}&search=1`,
    { timeoutMs: 8000 }
  );
  return (data.idGroup?.rxnormId ?? []).filter((id) => /^\d+$/.test(id)).slice(0, 4);
}

async function monographForRxcui(rxcui: string, drugName: string): Promise<PatientMonograph | null> {
  const payload = await fetchJson<unknown>(
    `https://connect.medlineplus.gov/service?mainSearchCriteria.v.cs=${RXNORM_CODE_SYSTEM}&mainSearchCriteria.v.c=${encodeURIComponent(rxcui)}&informationRecipient.languageCode.c=es&knowledgeResponseType=application/json`,
    { timeoutMs: 8000 }
  );
  const url = monographUrlFromConnect(payload);
  if (!url) return null;
  const html = await fetchText(url, { timeoutMs: 8000 });
  return parseSpanishMonograph(html, drugName, url);
}

/**
 * Ficha para el paciente del principio activo que ya coincidió.
 * No usa el modelo. Si la página no es de ese medicamento, no devuelve nada.
 */
export async function lookupSpanishPatientMonograph(input: {
  rxcui: string;
  drugName: string;
}): Promise<PatientMonograph | null> {
  const drugName = input.drugName.trim();
  const key = `${foldName(drugName)}:${input.rxcui}`;
  if (monographCache.has(key)) return monographCache.get(key) ?? null;

  const seen = new Set<string>();
  const tryOne = async (rxcui: string): Promise<PatientMonograph | null> => {
    if (!rxcui || seen.has(rxcui)) return null;
    seen.add(rxcui);
    return monographForRxcui(rxcui, drugName);
  };

  try {
    const first = /^\d+$/.test(input.rxcui) ? await tryOne(input.rxcui) : null;
    if (first) {
      monographCache.set(key, first);
      return first;
    }
    for (const rxcui of await exactRxcuis(drugName).catch(() => [] as string[])) {
      const monograph = await tryOne(rxcui);
      if (!monograph) continue;
      monographCache.set(key, monograph);
      return monograph;
    }
  } catch {
    monographCache.set(key, null);
    return null;
  }

  monographCache.set(key, null);
  return null;
}

const INTERACTION_LINE =
  /cualquier medicamento|otros medicamentos|qu[eé] medicamentos|complementos nutricionales|suplementos nutricionales|productos a base de plantas|productos a base de hierbas/i;

type PlainFact = { priority: number; text: string };

function monographSentences(page: PatientMonograph): string[] {
  return [page.administration, page.precautions, page.adverse]
    .join('\n')
    .split(/\n+|(?<=\.)\s+/)
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter((sentence) => sentence.length > 25);
}

function toEverydayClause(clause: string): string {
  return clause
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\btiene o ha tenido\b/gi, 'tienes o has tenido')
    .replace(/\bsu ritmo\b/gi, 'el ritmo')
    .replace(/\btiene\b/gi, 'tienes')
    .replace(/\bsu\b/gi, 'tu')
    .trim();
}

function finishSentence(text: string, maxChars = 260): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return /[.!?]$/.test(clean) ? clean : `${clean}.`;
  const slice = clean.slice(0, maxChars);
  const end = Math.max(slice.lastIndexOf(';'), slice.lastIndexOf(','), slice.lastIndexOf(' '));
  const piece = clean.slice(0, end > 40 ? end : maxChars).replace(/[;,:\s]+$/, '');
  return `${piece}.`;
}

function plainPrecautions(page: PatientMonograph): string | null {
  const sentences = monographSentences(page);
  const facts: PlainFact[] = [];
  const dose = sentences.find((sentence) =>
    /cantidad superior a la indicada|m[aá]s de la indicada en la etiqueta/i.test(sentence)
  );
  if (dose) {
    facts.push({ priority: 1, text: 'No tomes más de lo que indica el empaque o tu médico.' });
  }
  const sameIngredient = sentences.find((sentence) =>
    /mismos ingredientes activos|tomarlos juntos podr[ií]a causarle una sobredosis/i.test(sentence)
  );
  if (sameIngredient) {
    const label = monographDrugLabel(page);
    facts.push({
      priority: 2,
      text: `No combines medicamentos que también contengan ${label}.`,
    });
  }
  const abruptSentences = sentences.filter((sentence) => /bruscamente|no deje de tomar/i.test(sentence));
  if (abruptSentences.length > 0) {
    const heart = abruptSentences.some((sentence) => /card[ií]ac|coraz[oó]n/i.test(sentence));
    facts.push({
      priority: 3,
      text: heart
        ? 'No lo dejes de un día para otro. Si lo suspendes de golpe, puedes tener problemas del corazón.'
        : 'No lo dejes de un día para otro. Si lo suspendes de golpe, puedes tener problemas graves.',
    });
  }
  const duration = sentences.find(
    (sentence) => /dolor dura m[aá]s de \d+ d[ií]as/i.test(sentence) && /fiebre/i.test(sentence)
  );
  const painDays = duration?.match(/dolor dura m[aá]s de (\d+) d[ií]as/i);
  const feverDays = duration?.match(/fiebre (?:empeora o )?dura m[aá]s de (\d+) d[ií]as/i);
  if (painDays && feverDays) {
    facts.push({
      priority: 4,
      text: `Deja de tomarlo y llama al médico si el dolor dura más de ${painDays[1]} días o la fiebre dura más de ${feverDays[1]} días.`,
    });
  }
  const illnesses = sentences
    .filter((sentence) => /informe a su m[eé]dico si (?:tiene o ha tenido|tiene|su ritmo)/i.test(sentence))
    .slice(0, 2);
  for (const illness of illnesses) {
    const detail = toEverydayClause(illness.replace(/^.*informe a su m[eé]dico si /i, '').replace(/\.$/, ''));
    const clauses = detail
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .slice(0, 2);
    if (clauses.length === 0) continue;
    facts.push({
      priority: 5,
      text: finishSentence(`Antes de tomarlo, cuéntale a tu médico si ${clauses.join('; ')}`),
    });
  }
  if (/mareos|aturdimiento/i.test(page.adverse)) {
    facts.push({ priority: 6, text: 'Puede darte mareo.' });
  }
  const youngChildren = sentences.find(
    (sentence) => /menores de 2 a[nñ]os/i.test(sentence) && /tos|resfri/i.test(sentence)
  );
  if (youngChildren) {
    facts.push({
      priority: 7,
      text: 'Los productos combinados para la tos y el resfriado no se deben dar a niños menores de 2 años.',
    });
  }
  const pregnancy = sentences.find((sentence) => /embarazada/i.test(sentence) && /amamant/i.test(sentence));
  if (pregnancy) {
    facts.push({
      priority: 9,
      text: 'Si estás embarazada, planeas estarlo o das pecho, díselo a tu médico.',
    });
  }

  facts.sort((left, right) => left.priority - right.priority);
  const main = facts.filter((fact) => fact.priority <= 7).slice(0, 4);
  const chosen = main.length >= 2 ? main : facts.slice(0, 3);
  if (chosen.length === 0) return null;
  return chosen.map((fact) => fact.text).join(' ');
}

function monographDrugLabel(page: PatientMonograph): string {
  const named = page.purpose.match(/\b(?:el|la)\s+([a-záéíóúüñ]{4,})/i);
  return named?.[1]?.toLowerCase() || page.drugName.trim();
}

type CauseFocus = 'combine' | 'stop-suddenly' | 'dose' | 'none';

function causeFocus(message: string, previous: string): CauseFocus {
  if (/combin|juntos|otros medicamentos|otro medicamento|mismo componente|tambi[eé]n contengan/i.test(message)) {
    return 'combine';
  }
  if (/dosis|de m[aá]s|empaque/i.test(message)) return 'dose';
  if (/suspend|de golpe|de un d[ií]a|dejarlo/i.test(message)) return 'stop-suddenly';
  if (/^no lo dejes|suspendes de golpe/i.test(previous)) return 'stop-suddenly';
  if (/combines|juntes|tambi[eé]n contengan|mismo componente/i.test(previous)) return 'combine';
  if (/^no tomes m[aá]s/i.test(previous)) return 'dose';
  return 'none';
}

/** Explica el motivo de una recomendación ya dicha. No repite la orden ni inventa la causa. */
export function explainVerifiedCause(input: {
  message: string;
  previousAnswer: string;
  monograph: PatientMonograph;
}): string | null {
  const sentences = monographSentences(input.monograph);
  const label = monographDrugLabel(input.monograph);
  const focus = causeFocus(input.message, input.previousAnswer);

  if (focus === 'combine') {
    const source = sentences.find((sentence) =>
      /mismos ingredientes activos|tomarlos juntos podr[ií]a causarle una sobredosis/i.test(sentence)
    );
    if (!source) return null;
    return `Otros medicamentos también pueden contener ${label}. Si los tomas juntos, puedes pasar la dosis.`;
  }

  if (focus === 'stop-suddenly') {
    const consequence = sentences.find(
      (sentence) => /bruscamente/i.test(sentence) && /puede/i.test(sentence)
    );
    if (!consequence) return null;
    const heart = /card[ií]ac|coraz[oó]n/i.test(consequence);
    return heart
      ? 'Si lo dejas de golpe, puedes tener problemas graves del corazón.'
      : 'Si lo dejas de golpe, puedes tener problemas graves.';
  }

  if (focus === 'dose') {
    const harm = sentences.find((sentence) => /sobredosis|da[nñ]ar el h[ií]gado|da[nñ]o hep[aá]tico/i.test(sentence));
    if (!harm) return null;
    if (/h[ií]gado/i.test(harm)) return 'Tomar de más puede dañar el hígado.';
    return 'Tomar de más puede causarte una sobredosis.';
  }

  return null;
}

export function answerFromPatientMonograph(input: {
  name: string;
  aspect:
    | 'identity'
    | 'purpose'
    | 'administration'
    | 'precautions'
    | 'contraindications'
    | 'interactions'
    | 'adverse'
    | 'general';
  monograph: PatientMonograph;
}): string | null {
  const name = input.name.trim();
  const page = input.monograph;
  if (input.aspect === 'general') return null;

  if (input.aspect === 'purpose' || input.aspect === 'identity') {
    const sentence = sentencesOf(page.purpose)[0];
    if (!sentence) return `No tengo información comprobada sobre para qué se usa ${name}.`;
    return firstSentence(sentence, 420);
  }

  if (input.aspect === 'administration') {
    const practical = sentencesOf(page.administration)
      .filter((sentence) => !/no deje de tomar|bruscamente/i.test(sentence))
      .slice(0, 2)
      .map((sentence) => firstSentence(sentence, 240));
    if (practical.length === 0) return `No tengo instrucciones comprobadas de cómo se usa ${name}.`;
    return practical.join(' ');
  }

  if (input.aspect === 'precautions') {
    return plainPrecautions(page) || `No tengo precauciones comprobadas para ${name}.`;
  }

  if (input.aspect === 'contraindications') {
    const items = bulletsOf(page.precautions)
      .filter((line) => /al[eé]rgic|no tome|no lo use|podr[ií]a indicarle que no/i.test(line))
      .slice(0, 2)
      .map((line) => firstSentence(line));
    if (items.length === 0) return `No tengo contraindicaciones comprobadas para ${name}.`;
    return items.join(' ');
  }

  if (input.aspect === 'interactions') {
    const items = bulletsOf(page.precautions)
      .filter((line) => INTERACTION_LINE.test(line) || /interacci/i.test(line))
      .slice(0, 2)
      .map((line) => firstSentence(line));
    if (items.length === 0) return `No tengo interacciones comprobadas para ${name}.`;
    return items.join(' ');
  }

  const symptoms = bulletsOf(page.adverse)
    .filter((line) => line.length < 80 && !/medwatch|informe a su m[eé]dico si cualquiera|pueden ser graves/i.test(line))
    .slice(0, 5);
  if (symptoms.length === 0) return `No tengo efectos secundarios comprobados para ${name}.`;
  return `${name} puede causar ${symptoms.join(', ')}.`;
}
