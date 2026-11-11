import { fetchText, foldAccents } from '../utils/externalHttp';

export type HealthTopic = {
  title: string;
  summary: string;
  url: string;
};

function fold(value: string): string {
  return foldAccents(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function plain(value: string): string {
  const decoded = value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCharCode(Number(digits)));
  return decoded.replace(/<[^>]+>/g, ' ').replace(/\s+([,.;:!?])/g, '$1').replace(/\s+/g, ' ').trim();
}

function agrees(term: string, title: string): boolean {
  const requested = fold(term).split(' ').filter((token) => token.length >= 4);
  const other = fold(title);
  if (requested.length === 0 || !other) return false;
  return requested.every((token) => other.split(' ').includes(token));
}

function spokenSummary(text: string): string {
  const sentences = plain(text)
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 40 && !part.includes('?'));
  const chosen = sentences.slice(0, 2).join(' ');
  if (!chosen) return '';
  return /[.!?]$/.test(chosen) ? chosen : `${chosen}.`;
}

/** Lee el resultado de la búsqueda en español. No usa una ficha de otro tema ni una de medicamento. */
export function healthTopicFromSearch(xml: string, term: string): HealthTopic | null {
  const documents = [...xml.matchAll(/<document\b([^>]*)>([\s\S]*?)<\/document>/gi)];
  const found: HealthTopic[] = [];
  for (const document of documents) {
    const url = document[1].match(/\burl="([^"]+)"/i)?.[1] || '';
    const body = document[2];
    const title = plain(body.match(/<content name="title">([\s\S]*?)<\/content>/i)?.[1] || '');
    const summary = spokenSummary(body.match(/<content name="FullSummary">([\s\S]*?)<\/content>/i)?.[1] || '');
    if (!title || !summary || !url || !agrees(term, title)) continue;
    if (/\/druginfo\//i.test(url)) continue;
    found.push({ title, summary, url });
  }
  const exact = found.find((item) => fold(item.title) === fold(term));
  return exact || found[0] || null;
}

export async function lookupHealthTopic(term: string): Promise<HealthTopic | null> {
  const name = term.trim();
  if (name.length < 4) return null;
  try {
    const xml = await fetchText(
      `https://wsearch.nlm.nih.gov/ws/query?db=healthTopicsSpanish&term=${encodeURIComponent(name)}&retmax=5`,
      { timeoutMs: 8000 }
    );
    return healthTopicFromSearch(xml, name);
  } catch {
    return null;
  }
}
