export type CatalogIdentity = {
  name?: string | null;
  genericName?: string | null;
  brandNames?: Array<string | null> | null;
};

function foldLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:mg|ml|mcg|g|ui|%)\b/gi, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function labelsAgree(readName: string, candidate: string): boolean {
  const read = foldLabel(readName);
  const other = foldLabel(candidate);
  if (!read || !other) return false;
  if (read === other) return true;
  if (read.length >= 4 && (other.includes(read) || read.includes(other))) return true;

  const readTokens = read.split(' ').filter((token) => token.length >= 4);
  const otherTokens = other.split(' ').filter((token) => token.length >= 4);
  return readTokens.some((token) =>
    otherTokens.some((otherToken) => {
      if (token === otherToken) return true;
      const limit = Math.min(token.length, otherToken.length);
      let prefix = 0;
      while (prefix < limit && token.charCodeAt(prefix) === otherToken.charCodeAt(prefix)) {
        prefix += 1;
      }
      return prefix >= 6;
    })
  );
}

/**
 * Texto de respaldo cuando no hay una explicación del producto.
 * Una lectura que también describe el empaque no entra aquí.
 */
export function isGenericMedicationReading(value: string): boolean {
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) return true;
  return /^(?:[\p{L}\p{N}][\p{L}\p{N}\s.'’-]{0,80}?\s+)?es un medicamento\.?\s*sigue siempre las indicaciones de tu m[eé]dico o farmac[eé]utico\.?(?:\s*si tienes dudas, consulta a un profesional de la salud\.?)?$/iu.test(
    text
  );
}

/**
 * El nombre leído en la foto y la ficha de referencia hablan del mismo medicamento.
 * No decide el reconocimiento: solo evita mostrar el principio activo de otro fármaco.
 */
export function noteFromRecognition(input: {
  purpose?: string | null;
  observedReading?: string | null;
}): string | undefined {
  if (input.purpose?.trim()) return undefined;
  const reading = input.observedReading?.trim();
  if (!reading || isGenericMedicationReading(reading)) return undefined;
  return reading.slice(0, 500);
}

/**
 * Lectura que puede guardarse en un medicamento que ya existe y no tiene nota.
 * No reemplaza un texto que la persona ya escribió.
 */
export function readingForExistingMedication(
  existingDescription: string | null | undefined,
  reading: string | null | undefined
): string | undefined {
  const next = reading?.trim();
  if (!next || isGenericMedicationReading(next)) return undefined;
  const current = existingDescription?.trim() || '';
  if (current && !isGenericMedicationReading(current)) return undefined;
  return next.slice(0, 500);
}

export function catalogAgreesWithReadName(
  readName: string,
  catalog: CatalogIdentity | null | undefined
): boolean {
  if (!catalog) return false;
  const candidates = [catalog.name, catalog.genericName, ...(catalog.brandNames ?? [])];
  return candidates.some((candidate) => typeof candidate === 'string' && labelsAgree(readName, candidate));
}
