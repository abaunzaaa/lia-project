import { ViewStyle } from 'react-native';

export type Appearance = 'light' | 'dark' | 'highContrast';

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
  background: '#F5EFEB',
  surface: '#FFFCFA',
  surfaceElevated: '#FFFFFF',
  textPrimary: '#2F4156',
  textSecondary: '#567C8D',
  textMuted: '#8A9AA6',
  border: '#D9E4EC',
  success: '#4A7C6F',
  warning: '#B5791A',
  error: '#A84A40',
  info: '#567C8D',
  overlay: 'rgba(47, 65, 86, 0.45)',
  onPrimary: '#FFFFFF',
  accentSoft: '#C8D9E6',
  successSoft: '#E4F0EC',
  warningSoft: '#F8EEDC',
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
  textMuted: '#87939E',
  border: '#2C3946',
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

/** Negro + blanco. El estado nunca depende solo del color. */
export const highContrast: ColorPalette = {
  primary: '#FFFFFF',
  primaryLight: '#111111',
  primaryDark: '#FFFFFF',
  secondary: '#FFFFFF',
  background: '#000000',
  surface: '#000000',
  surfaceElevated: '#0A0A0A',
  textPrimary: '#FFFFFF',
  textSecondary: '#FFFFFF',
  textMuted: '#E6E6E6',
  border: '#FFFFFF',
  success: '#FFFFFF',
  warning: '#FFFFFF',
  error: '#FFFFFF',
  info: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.82)',
  onPrimary: '#000000',
  accentSoft: '#111111',
  successSoft: '#111111',
  warningSoft: '#111111',
  errorSoft: '#111111',
  taken: '#FFFFFF',
  pending: '#FFFFFF',
  missed: '#FFFFFF',
  focusRing: '#FFFFFF',
};

export const palettes: Record<Appearance, ColorPalette> = {
  light,
  dark,
  highContrast,
};

export function getShadows(appearance: Appearance): Record<'none' | 'sm' | 'md' | 'lg', ViewStyle> {
  if (appearance === 'highContrast') {
    return {
      none: {},
      sm: { borderWidth: 2, borderColor: '#FFFFFF' },
      md: { borderWidth: 2, borderColor: '#FFFFFF' },
      lg: { borderWidth: 2, borderColor: '#FFFFFF' },
    };
  }

  const shadowColor = appearance === 'dark' ? '#000000' : '#1A2733';
  const opacity = appearance === 'dark' ? 0.35 : 0.08;

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
