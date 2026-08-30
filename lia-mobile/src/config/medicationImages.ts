import { Image, ImageSourcePropType } from 'react-native';
import { normalizeMedicationName } from '../utils/helpers';

/** Espacio reservado para la foto en la tarjeta (sin recuadro). */
export const MEDICATION_IMAGE_SLOT = {
  width: 108,
  height: 118,
};

const CATALOG: Record<string, ImageSourcePropType> = {
  acetaminofen: require('../assets/medications/acetaminofen.png'),
  paracetamol: require('../assets/medications/acetaminofen.png'),
  losartan: require('../assets/medications/losartan.png'),
  ibuprofeno: require('../assets/medications/ibuprofeno.png'),
  ibuprofen: require('../assets/medications/ibuprofeno.png'),
  sprainer: require('../assets/medications/sprainer.png'),
  alcohol: require('../assets/medications/alcohol.png'),
  azitromicina: require('../assets/medications/azitromicina.png'),
};

function catalogKeyForName(name: string): string | null {
  const normalized = normalizeMedicationName(name);
  if (!normalized) return null;
  if (CATALOG[normalized]) return normalized;
  const firstWord = normalized.split(' ')[0];
  if (firstWord && CATALOG[firstWord]) return firstWord;
  return null;
}

function catalogSourceForName(name: string): ImageSourcePropType | undefined {
  const key = catalogKeyForName(name);
  if (!key) return undefined;
  return CATALOG[key];
}

function resolveCatalogAsset(source: ImageSourcePropType) {
  try {
    return Image.resolveAssetSource(source);
  } catch {
    return null;
  }
}

/** URI del PNG del catálogo, o undefined si no hay coincidencia. */
export function getMedicationImage(name: string): string | undefined {
  const source = catalogSourceForName(name);
  if (!source) return undefined;
  return resolveCatalogAsset(source)?.uri || undefined;
}

/**
 * Escala visual para equilibrar el peso dentro del slot.
 * Retratos que ya llenan la altura (p. ej. Losartán) quedan en 1.
 * Apaisados (p. ej. Acetaminofén) se agrandan hasta acercarse a esa altura.
 */
export function getMedicationImageScale(name: string): number {
  const source = catalogSourceForName(name);
  if (!source) return 1;
  const resolved = resolveCatalogAsset(source);
  const width = resolved?.width;
  const height = resolved?.height;
  if (!width || !height) return 1;

  const fittedHeight =
    height * Math.min(MEDICATION_IMAGE_SLOT.width / width, MEDICATION_IMAGE_SLOT.height / height);
  if (fittedHeight >= MEDICATION_IMAGE_SLOT.height * 0.98) return 1;

  return Math.min(1.4, MEDICATION_IMAGE_SLOT.height / fittedHeight);
}
