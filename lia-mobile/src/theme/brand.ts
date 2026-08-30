/**
 * Identidad editorial LÍA — paleta de marca.
 * Usada en bienvenida; el tema global se alineará progresivamente.
 */
export const BrandColors = {
  navy: '#2F4156',
  teal: '#567C8D',
  skyBlue: '#C8D9E6',
  /** Alias de blanco puro. No usar como relleno beige/crema. */
  beige: '#FFFFFF',
  white: '#FFFFFF',
  cardBorder: '#F0F1F2',
} as const;

/** Borde de tarjetas: gris claro en modo claro; sutil del tema en oscuro/contraste (como Perfil). */
export function liaCardBorder(lightChrome: boolean, themeBorder: string): string {
  return lightChrome ? BrandColors.cardBorder : themeBorder;
}

/** Navy en claro; en oscuro/contraste usa el texto del tema. */
export function brandInk(
  isDark: boolean,
  isHighContrast: boolean,
  textPrimary: string
): string {
  if (isHighContrast || isDark) return textPrimary;
  return BrandColors.navy;
}

/** Teal en claro; en oscuro usa primary del tema. */
export function brandAccent(
  isDark: boolean,
  isHighContrast: boolean,
  primary: string,
  textPrimary: string
): string {
  if (isHighContrast) return textPrimary;
  if (isDark) return primary;
  return BrandColors.teal;
}
