import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';
import { Space } from '../theme/tokens';

/** Breakpoints base — composición, no solo escala. */
export const Breakpoints = {
  smallPhone: 360,
  largePhone: 430,
  tablet: 600,
  shortHeight: 680,
} as const;

export function useResponsive() {
  const { width, height, fontScale } = useWindowDimensions();
  const { isSeniorMode, scaleSpacing } = useAccessibility();

  return useMemo(() => {
    const isSmallPhone = width < Breakpoints.smallPhone;
    const isLargePhone = width >= Breakpoints.largePhone && width < Breakpoints.tablet;
    const isPhone = width >= Breakpoints.smallPhone && width < Breakpoints.tablet;
    const isTablet = width >= Breakpoints.tablet;
    const isShortScreen =
      height < Breakpoints.shortHeight || (isSeniorMode && height < Breakpoints.shortHeight + 80);

    const horizontalPadding = scaleSpacing(
      isTablet ? Space[32] : isSmallPhone ? Space[16] : Space[20]
    );

    const contentMaxWidth = isTablet ? 640 : 560;

    /** Altura del hero de bienvenida como fracción de pantalla */
    const welcomeHeroHeight = Math.round(
      Math.min(
        isTablet ? 380 : isShortScreen ? height * 0.34 : height * 0.4,
        isTablet ? 420 : isShortScreen ? 280 : 360
      )
    );

    return {
      width,
      height,
      fontScale,
      isSmallPhone,
      isPhone,
      isLargePhone,
      isTablet,
      isShortScreen,
      compact: isShortScreen || isSmallPhone,
      horizontalPadding,
      contentMaxWidth,
      welcomeHeroHeight,
    };
  }, [width, height, fontScale, isSeniorMode, scaleSpacing]);
}
