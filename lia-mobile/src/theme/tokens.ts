import { Platform } from 'react-native';

/**
 * LÍA Design Tokens
 *
 * Tipografía: sistema nativo (SF / Roboto), muy legible y compatible con Expo Go.
 * Atkinson Hyperlegible se cargará con expo-font cuando existan los .ttf en assets/fonts.
 * No se inventan archivos de fuente ni se instalan paquetes extra.
 */
export const FontFamily = {
  regular: Platform.select({ ios: 'System', android: 'sans-serif', default: undefined }),
  medium: Platform.select({ ios: 'System', android: 'sans-serif-medium', default: undefined }),
  semiBold: Platform.select({ ios: 'System', android: 'sans-serif-medium', default: undefined }),
  bold: Platform.select({ ios: 'System', android: 'sans-serif', default: undefined }),
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
};

/** Escala 4–40. Los alias xs–xxxl cubren pantallas existentes. */
export const Space = {
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  40: 40,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 9999,
} as const;

export const Layout = {
  contentMaxWidth: 560,
  contentMaxWidthTablet: 640,
  screenPadding: 20,
  minTouchTarget: 48,
  tabBarHeight: 60,
} as const;

/**
 * Roles tipográficos. Los tamaños son base; AccessibilityContext los escala.
 * Line-height generoso para lectura de adultos mayores.
 */
export const TypeRole = {
  display: { size: 40, lineHeight: 48, weight: FontWeight.bold, letterSpacing: -0.6 },
  h1: { size: 28, lineHeight: 36, weight: FontWeight.bold, letterSpacing: -0.3 },
  h2: { size: 22, lineHeight: 30, weight: FontWeight.semiBold, letterSpacing: -0.2 },
  h3: { size: 18, lineHeight: 26, weight: FontWeight.semiBold, letterSpacing: 0 },
  bodyLarge: { size: 18, lineHeight: 28, weight: FontWeight.regular, letterSpacing: 0.1 },
  body: { size: 16, lineHeight: 24, weight: FontWeight.regular, letterSpacing: 0.1 },
  caption: { size: 14, lineHeight: 20, weight: FontWeight.medium, letterSpacing: 0.15 },
  button: { size: 17, lineHeight: 22, weight: FontWeight.semiBold, letterSpacing: 0.2 },
  medicationName: { size: 22, lineHeight: 28, weight: FontWeight.bold, letterSpacing: -0.2 },
  timeDisplay: { size: 40, lineHeight: 46, weight: FontWeight.bold, letterSpacing: -0.8 },
  label: { size: 15, lineHeight: 20, weight: FontWeight.semiBold, letterSpacing: 0.2 },
  overline: { size: 12, lineHeight: 16, weight: FontWeight.semiBold, letterSpacing: 1.2 },
} as const;

export type TypeRoleName = keyof typeof TypeRole;

/** Compatibilidad con Typography.sizes de pantallas aún no rediseñadas */
export const TypeSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  hero: 40,
} as const;
