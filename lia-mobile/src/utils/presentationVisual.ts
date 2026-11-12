import { ImageSourcePropType } from 'react-native';
import { GENERIC_MEDICATION_IMAGE } from '../config/medicationImages';
import { MedicationPresentation } from './medicationFormHelpers';
import { presentationAssets } from './medicationFormAssets';

/**
 * Ilustración local de la presentación elegida.
 * Si no hay presentación conocida, usa la tableta genérica ya incluida en LÍA.
 */
export function presentationVisualSource(
  presentation?: MedicationPresentation | null
): ImageSourcePropType {
  if (presentation && presentationAssets[presentation]) {
    return presentationAssets[presentation];
  }
  return GENERIC_MEDICATION_IMAGE;
}

/** Ilustración del resultado de cámara a partir del texto de presentación. */
export function recognitionArtSource(presentation?: string | null): ImageSourcePropType {
  const text = (presentation || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (/gota|colirio|oftalm/.test(text)) return presentationAssets.drops;
  if (/capsul/.test(text)) return presentationAssets.capsule;
  if (/tablet|comprim|gragea|pastilla/.test(text)) return presentationAssets.tablet;
  if (/sobre|sachet|polvo/.test(text)) return presentationAssets.sachet;
  if (/jarabe|suspens|solucion|solution|syrup|liquid|crema|gel|emulsion/.test(text)) {
    return presentationAssets.liquid;
  }
  if (presentation && presentationAssets[presentation as MedicationPresentation]) {
    return presentationAssets[presentation as MedicationPresentation];
  }
  return GENERIC_MEDICATION_IMAGE;
}
