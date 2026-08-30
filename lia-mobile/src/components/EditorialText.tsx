import React from 'react';
import {
  Text,
  TextProps,
  StyleSheet,
} from 'react-native';

import { FontFamily, FontWeight } from '../theme/tokens';
import { BrandColors } from '../theme/brand';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';

type EditorialVariant = 'display' | 'headline' | 'subhead';

const VARIANTS: Record<
  EditorialVariant,
  {
    size: number;
    lineHeight: number;
    letterSpacing: number;
  }
> = {
  display: {
    size: 38,
    lineHeight: 44,
    letterSpacing: -0.6,
  },

  headline: {
    size: 34,
    lineHeight: 40,
    letterSpacing: -0.4,
  },

  subhead: {
    size: 26,
    lineHeight: 32,
    letterSpacing: -0.2,
  },
};

interface EditorialTextProps extends TextProps {
  variant?: EditorialVariant;
  children: React.ReactNode;
  accent?: boolean;
}

export default function EditorialText({
  variant = 'headline',
  children,
  style,
  accent = false,
  ...rest
}: EditorialTextProps) {

  const {
    isDark,
    isHighContrast,
    colors,
  } = useTheme();

  const {
    scaleFont,
  } = useAccessibility();


  const role = VARIANTS[variant];


  const color =
    isHighContrast
      ? '#FFFFFF'
      : accent
        ? isDark
          ? colors.primary
          : BrandColors.teal
        : isDark
          ? BrandColors.white
          : BrandColors.navy;


  return (

    <Text
      {...rest}
      maxFontSizeMultiplier={1.35}

      style={[
        styles.base,

        {
          fontFamily: FontFamily.semiBold,

          fontSize:
            scaleFont(role.size),

          lineHeight:
            scaleFont(role.lineHeight),

          fontWeight:
            FontWeight.semiBold,

          letterSpacing:
            role.letterSpacing,

          color,
        },

        style,
      ]}
    >

      {children}

    </Text>

  );
}


const styles = StyleSheet.create({

  base: {
    fontStyle: 'normal',
  },

});