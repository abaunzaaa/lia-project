export type ParsedCameraDeviceRaw = {
  medicationName: string | null;
  voiceText: string | null;
};

function stripMarkdownFences(input: string): string {
  return input
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function cleanName(value: string): string | null {
  let name = value.trim();
  name = name.replace(/^["'`]+|["'`]+$/g, '').trim();
  if (!name) return null;
  if (/^NO_IDENTIFICADO$/i.test(name)) return null;
  if (name.length > 120) return null;
  return name;
}

function looksLikeSafeMedicationName(value: string): boolean {
  const name = value.trim();
  if (name.length < 2 || name.length > 80) return false;
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length > 8) return false;
  if (/https?:\/\//i.test(name)) return false;
  if (/[{}\[\]<>]/.test(name)) return false;
  if (/^(nombre|voz|error|http)\b/i.test(name)) return false;
  return /^[\p{L}\p{N}][\p{L}\p{N}\s.'’\-\/()+,]*$/u.test(name);
}

function parseLabeledFormat(raw: string): ParsedCameraDeviceRaw {
  const nameMatch = raw.match(/nombre\s*:\s*([^\r\n]+)/i);
  const voiceMatch = raw.match(/voz\s*:\s*([\s\S]+)/i);
  return {
    medicationName: nameMatch ? cleanName(nameMatch[1]) : null,
    voiceText: voiceMatch ? voiceMatch[1].trim() || null : null,
  };
}

function parseJsonFormat(raw: string): ParsedCameraDeviceRaw | null {
  const stripped = stripMarkdownFences(raw);
  if (!stripped.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(stripped) as {
      medicationName?: unknown;
      voiceText?: unknown;
      nombre?: unknown;
      voz?: unknown;
    };
    const nameRaw =
      typeof parsed.medicationName === 'string'
        ? parsed.medicationName
        : typeof parsed.nombre === 'string'
          ? parsed.nombre
          : '';
    const voiceRaw =
      typeof parsed.voiceText === 'string'
        ? parsed.voiceText
        : typeof parsed.voz === 'string'
          ? parsed.voz
          : '';
    return {
      medicationName: cleanName(nameRaw),
      voiceText: voiceRaw.trim() || null,
    };
  } catch {
    return null;
  }
}

/**
 * Interpreta el texto bruto de Gemini (NOMBRE/VOZ o JSON).
 * No inventa medicamentos: si no hay nombre seguro, medicationName queda null.
 */
export function parseCameraDeviceRaw(rawResult: string): ParsedCameraDeviceRaw {
  const raw = rawResult.replace(/\r\n/g, '\n').trim();
  if (!raw) return { medicationName: null, voiceText: null };

  const fromJson = parseJsonFormat(raw);
  if (fromJson && (fromJson.medicationName || fromJson.voiceText)) {
    return fromJson;
  }

  const labeled = parseLabeledFormat(raw);
  if (labeled.medicationName || labeled.voiceText) {
    return {
      medicationName: labeled.medicationName,
      voiceText: labeled.voiceText || raw.slice(0, 2000) || null,
    };
  }

  const firstSentence = raw.split(/[.!?]/)[0]?.trim() || '';
  if (looksLikeSafeMedicationName(firstSentence)) {
    return {
      medicationName: cleanName(firstSentence),
      voiceText: raw.slice(0, 2000) || null,
    };
  }

  const firstLine = raw.split('\n').map((l) => l.trim()).find(Boolean) || '';
  if (looksLikeSafeMedicationName(firstLine)) {
    return {
      medicationName: cleanName(firstLine),
      voiceText: raw.slice(0, 2000) || null,
    };
  }

  return { medicationName: null, voiceText: raw.slice(0, 2000) || null };
}
