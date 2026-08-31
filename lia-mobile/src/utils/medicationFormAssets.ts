import { ImageSourcePropType } from 'react-native';
import { MealRelation, MedicationPresentation } from './medicationFormHelpers';

export const presentationAssets: Record<MedicationPresentation, ImageSourcePropType> = {
  tablet: require('../assets/images/medication-form/presentation-tablet.png'),
  capsule: require('../assets/images/medication-form/presentation-capsule.png'),
  liquid: require('../assets/images/medication-form/presentation-liquid.png'),
  drops: require('../assets/images/medication-form/presentation-drops.png'),
  sachet: require('../assets/images/medication-form/presentation-sachet.png'),
};

export const scheduleClockAsset = require('../assets/images/medication-form/schedule-clock.png');
export const scheduleClockAddAsset = require('../assets/images/medication-form/schedule-clock-add.png');
export const scheduleBellAsset = require('../assets/images/medication-form/schedule-bell.png');

export const mealAssets: Record<MealRelation, ImageSourcePropType> = {
  before_meal: require('../assets/images/medication-form/meal-before.png'),
  after_meal: require('../assets/images/medication-form/meal-after.png'),
  with_meal: require('../assets/images/medication-form/meal-with.png'),
};

export const treatmentCalendarAsset = require('../assets/images/medication-form/treatment-calendar.png');
export const treatmentNotesAsset = require('../assets/images/medication-form/treatment-notes.png');
