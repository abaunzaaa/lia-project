import { light } from '../theme/themes';
import { FontFamily, Space, Radius, TypeSizes } from '../theme/tokens';

/**
 * Capa de compatibilidad para pantallas aún no migradas a useTheme().
 * Los colores coinciden con el tema claro profesional de LÍA.
 */
export const Colors = {
  primary: light.primary,
  primaryDark: light.primaryDark,
  primaryLight: light.primaryLight,
  white: light.surfaceElevated,
  green: light.success,
  greenDark: light.secondary,
  beige: light.background,
  text: light.textPrimary,
  textSecondary: light.textSecondary,
  textLight: light.textMuted,
  error: light.error,
  warning: light.warning,
  success: light.success,
  border: light.border,
  shadow: 'rgba(26, 39, 51, 0.08)',
  overlay: light.overlay,
  taken: light.taken,
  pending: light.pending,
  missed: light.missed,
} as const;

export const Typography = {
  fontFamily: {
    regular: FontFamily.regular ?? 'System',
    medium: FontFamily.medium ?? 'System',
    semiBold: FontFamily.semiBold ?? 'System',
    bold: FontFamily.bold ?? 'System',
  },
  sizes: TypeSizes,
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.7,
  },
} as const;

export const Spacing = {
  xs: Space.xs,
  sm: Space.sm,
  md: Space.md,
  lg: Space.lg,
  xl: Space.xl,
  xxl: Space.xxl,
} as const;

export const BorderRadius = {
  sm: Radius.sm,
  md: Radius.md,
  lg: Radius.lg,
  xl: Radius.xl,
  full: Radius.full,
} as const;

export const Shadows = {
  sm: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  md: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  lg: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 6,
  },
} as const;

/** @deprecated Usar AccessibilityContext. Se mantiene para helpers. */
export const AccessibilityScale = {
  normal: { fontScale: 1, buttonScale: 1, spacingScale: 1 },
  senior: { fontScale: 1.22, buttonScale: 1.28, spacingScale: 1.16 },
} as const;

export type AccessibilityMode = keyof typeof AccessibilityScale;
