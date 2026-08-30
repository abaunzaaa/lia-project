import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';

import {
  FontFamily,
  FontWeight,
  TypeRole,
  TypeRoleName,
} from '../theme/tokens';

import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';


type Tone =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'inverse'
  | 'success'
  | 'error';


interface AppTextProps extends TextProps {

  variant?: TypeRoleName;

  tone?: Tone;

  children: React.ReactNode;

}



export default function AppText({

  variant = 'body',

  tone = 'primary',

  style,

  children,

  ...rest

}: AppTextProps) {


  const { colors } = useTheme();

  const { scaleFont } = useAccessibility();

  const role = TypeRole[variant];



  const toneColor = {

    primary: colors.textPrimary,

    secondary: colors.textSecondary,

    muted: colors.textMuted,

    inverse: colors.onPrimary,

    success: colors.success,

    error: colors.error,

  }[tone];



  const fontFamily = getFontFamily(variant);



  return (

    <Text

      {...rest}

      maxFontSizeMultiplier={1.35}

      textBreakStrategy="simple"

      style={[

        styles.base,

        {

          fontFamily,

          fontSize: scaleFont(role.size),

          lineHeight: scaleFont(role.lineHeight),

          fontWeight: role.weight,

          letterSpacing: role.letterSpacing,

          color: toneColor,

        },

        variant === 'overline' && styles.overline,

        style,

      ]}

    >

      {children}

    </Text>

  );

}





function getFontFamily(
  variant: TypeRoleName
) {

  switch (variant) {


    // TÍTULOS
    case 'display':
    case 'h1':
    case 'h2':
    case 'h3':
    case 'medicationName':
    case 'timeDisplay':

      return FontFamily.semiBold;



    // BOTONES / ETIQUETAS

    case 'button':
    case 'label':
    case 'caption':
    case 'overline':

      return FontFamily.medium;



    // TEXTO NORMAL

    default:

      return FontFamily.regular;

  }

}





const styles = StyleSheet.create({

  base: {

    fontFamily: FontFamily.regular,

  },


  overline: {

    textTransform: 'uppercase',

    fontWeight: FontWeight.semiBold,

  },

});