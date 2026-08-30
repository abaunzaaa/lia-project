import { ViewStyle } from 'react-native';

export type ColorScheme = 'light' | 'dark';
/** @deprecated Use ColorScheme. Kept for stored-value migration. */
export type Appearance = ColorScheme | 'highContrast';

export type ColorPalette = {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  overlay: string;
  onPrimary: string;
  accentSoft: string;
  successSoft: string;
  warningSoft: string;
  errorSoft: string;
  taken: string;
  pending: string;
  missed: string;
  focusRing: string;
};

export const light: ColorPalette = {
  primary: '#2F4156',
  primaryLight: '#E8EEF2',
  primaryDark: '#243342',
  secondary: '#567C8D',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  textPrimary: '#2F4156',
  textSecondary: '#567C8D',
  textMuted: '#8A9AA6',
  border: '#F0F1F2',
  success: '#4A7C6F',
  warning: '#B5791A',
  error: '#A84A40',
  info: '#567C8D',
  overlay: 'rgba(47, 65, 86, 0.45)',
  onPrimary: '#FFFFFF',
  accentSoft: '#C8D9E6',
  successSoft: '#E4F0EC',
  warningSoft: '#E8EEF2',
  errorSoft: '#F6E8E6',
  taken: '#4A7C6F',
  pending: '#567C8D',
  missed: '#8A9AA6',
  focusRing: '#2F4156',
};

export const dark: ColorPalette = {
  primary: '#8BB8D9',
  primaryLight: '#1E3348',
  primaryDark: '#C5DCEB',
  secondary: '#8FBFAB',
  background: '#10161C',
  surface: '#182028',
  surfaceElevated: '#222C36',
  textPrimary: '#F1EEE8',
  textSecondary: '#B4BFC8',
  textMuted: '#B0BAC3',
  border: '#4A5C6B',
  success: '#7DC4A0',
  warning: '#E0B05C',
  error: '#E08B82',
  info: '#8BB8D9',
  overlay: 'rgba(0, 0, 0, 0.62)',
  onPrimary: '#102030',
  accentSoft: '#1E3348',
  successSoft: '#1A3328',
  warningSoft: '#332A16',
  errorSoft: '#331F1D',
  taken: '#7DC4A0',
  pending: '#8BB8D9',
  missed: '#C5CDD4',
  focusRing: '#8BB8D9',
};

/** Tema claro con bordes y texto más marcados. No es modo noche. */
export const lightHighContrast: ColorPalette = {
  primary: '#173B59',
  primaryLight: '#EAF5FB',
  primaryDark: '#10161C',
  secondary: '#314A5C',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#EAF5FB',
  textPrimary: '#10161C',
  textSecondary: '#314A5C',
  textMuted: '#527181',
  border: '#527181',
  success: '#1F5C4C',
  warning: '#8A5A10',
  error: '#8B2E28',
  info: '#173B59',
  overlay: 'rgba(16, 22, 28, 0.5)',
  onPrimary: '#FFFFFF',
  accentSoft: '#EAF5FB',
  successSoft: '#E4F0EC',
  warningSoft: '#E8EEF2',
  errorSoft: '#F6E8E6',
  taken: '#1F5C4C',
  pending: '#173B59',
  missed: '#527181',
  focusRing: '#173B59',
};

/** Tema oscuro con contraste máximo. */
export const darkHighContrast: ColorPalette = {
  primary: '#F4F7FA',
  primaryLight: '#000000',
  primaryDark: '#FFFFFF',
  secondary: '#E8EEF2',
  background: '#000000',
  surface: '#000000',
  surfaceElevated: '#12181E',
  textPrimary: '#FFFFFF',
  textSecondary: '#E8EEF2',
  textMuted: '#DCE8EE',
  border: '#E8EEF2',
  success: '#A6E3C5',
  warning: '#F0C56A',
  error: '#F0A8A0',
  info: '#F4F7FA',
  overlay: 'rgba(0, 0, 0, 0.82)',
  onPrimary: '#000000',
  accentSoft: '#12181E',
  successSoft: '#0A1A12',
  warningSoft: '#1A1408',
  errorSoft: '#1A0C0A',
  taken: '#A6E3C5',
  pending: '#F4F7FA',
  missed: '#DCE8EE',
  focusRing: '#FFFFFF',
};

export function resolvePalette(scheme: ColorScheme, highContrast: boolean): ColorPalette {
  if (scheme === 'dark') return highContrast ? darkHighContrast : dark;
  return highContrast ? lightHighContrast : light;
}

/** Alias de alto contraste claro (compatibilidad). */
export const highContrast = lightHighContrast;

export const palettes: Record<ColorScheme, ColorPalette> = {
  light,
  dark,
};

export function getShadows(
  scheme: ColorScheme,
  highContrastEnabled = false
): Record<'none' | 'sm' | 'md' | 'lg', ViewStyle> {
  if (highContrastEnabled) {
    const borderColor = scheme === 'dark' ? '#E8EEF2' : '#527181';
    return {
      none: {},
      sm: { borderWidth: 2, borderColor },
      md: { borderWidth: 2, borderColor },
      lg: { borderWidth: 2, borderColor },
    };
  }

  const shadowColor = scheme === 'dark' ? '#000000' : '#1A2733';
  const opacity = scheme === 'dark' ? 0.35 : 0.08;

  return {
    none: {},
    sm: {
      shadowColor,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: opacity,
      shadowRadius: 4,
      elevation: 1,
    },
    md: {
      shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: opacity + 0.02,
      shadowRadius: 12,
      elevation: 3,
    },
    lg: {
      shadowColor,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: opacity + 0.04,
      shadowRadius: 20,
      elevation: 6,
    },
  };
}
