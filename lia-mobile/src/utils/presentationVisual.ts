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
