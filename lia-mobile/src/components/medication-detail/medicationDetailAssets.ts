import type { ImageSourcePropType } from 'react-native';

/**
 * Assets 3D del detalle. Ruta desde este archivo:
 * src/components/medication-detail → ../../assets/images/medications
 */
export const MEDICATION_TABLET_BASE_SOURCE: ImageSourcePropType = require(
  '../../assets/images/medications/medication-tablet-base.png'
);
export const MEDICATION_CLOCK_SOURCE: ImageSourcePropType = require(
  '../../assets/images/medications/medication-clock.png'
);
export const LIA_QUESTION_BUBBLE_SOURCE: ImageSourcePropType = require(
  '../../assets/images/medications/lia-question-bubble.png'
);
export const MEDICATION_STOCK_IMAGE_SOURCE: ImageSourcePropType = require(
  '../../assets/images/medications/medication-identification-hero-placeholder.png'
);

export const medicationDetailAssets = {
  medicationHero: MEDICATION_TABLET_BASE_SOURCE,
  clock: MEDICATION_CLOCK_SOURCE,
  liaBubble: LIA_QUESTION_BUBBLE_SOURCE,
} as const;

export const DETAIL_STOCK_FILL = '#F5EFEB';
export const DETAIL_HAIRLINE = '#D7E4EA';
export const DETAIL_HERO_RADIUS = 20;
export const DETAIL_CARD_RADIUS = 20;
export const DETAIL_INFO_RADIUS = 18;
export const DETAIL_STOCK_RADIUS = 16;
export const DETAIL_BUTTON_RADIUS = 16;
export const DETAIL_SCHEDULE_OVERLAP = 22;
export const DETAIL_CLOCK_SIZE = 54;
export const DETAIL_BUBBLE_SIZE = 32;
