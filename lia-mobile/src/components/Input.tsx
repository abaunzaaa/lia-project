import React, { useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { FontFamily, Layout, Radius, Space } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import AppText from './AppText';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  /** Control visible “Mostrar / Ocultar” para contraseñas. */
  secureToggle?: boolean;
  /** Campos blancos con borde gris claro (identidad Perfil / Home). */
  chrome?: 'default' | 'white';
}

const Input = React.forwardRef<TextInput, InputProps>(function Input(
  { label, error, icon, style, secureToggle, secureTextEntry, accessibilityHint, chrome = 'default', ...props },
  ref
) {
  const { colors, isHighContrast, isDark } = useTheme();
  const { scaleFont, minTouch, scaleSpacing } = useAccessibility();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const isSecure = secureToggle ? hidden : !!secureTextEntry;
  const whiteChrome = !isHighContrast && (chrome === 'white' || !isDark);

  return (
    <View style={[styles.container, { marginBottom: scaleSpacing(Space[16]) }]}>
      {label ? (
        <AppText
          variant={whiteChrome ? 'body' : 'label'}
          style={{
            marginBottom: scaleSpacing(Space[8]),
            ...(whiteChrome
              ? {
                  color: '#6F747A',
                  fontWeight: '400',
                }
              : null),
          }}
        >
          {label}
        </AppText>
      ) : null}
      <View
        style={[
          styles.inputWrapper,
          {
            minHeight: Math.max(minTouch + 8, 56),
            backgroundColor: whiteChrome ? '#FFFFFF' : colors.surface,
            borderRadius: whiteChrome ? Radius.lg : Radius.md,
            borderWidth: isHighContrast ? 2 : focused ? 2 : 1,
            borderColor: error
              ? colors.error
              : focused
                ? colors.focusRing
                : whiteChrome
                  ? '#F0F1F2'
                  : colors.border,
            paddingHorizontal: scaleSpacing(Space[16]),
          },
        ]}
      >
        {icon ? <View style={{ marginRight: scaleSpacing(Space[8]) }}>{icon}</View> : null}
        <TextInput
          ref={ref}
          style={[
            styles.input,
            {
              fontSize: scaleFont(16),
              color: colors.textPrimary,
              paddingVertical: scaleSpacing(Space[12]),
            },
            style,
          ]}
          placeholderTextColor={colors.textMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          accessibilityHint={accessibilityHint}
          accessibilityState={{ disabled: props.editable === false }}
          secureTextEntry={isSecure}
          {...props}
        />
        {secureToggle ? (
          <Pressable
            onPress={() => setHidden((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'}
            accessibilityHint="Cambia si el texto de la contraseña es visible"
            accessibilityState={{ selected: !hidden }}
            hitSlop={8}
            style={[styles.toggle, { minHeight: minTouch, minWidth: Math.max(minTouch, 72) }]}
          >
            <AppText variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>
              {hidden ? 'Mostrar' : 'Ocultar'}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" tone="error" style={{ marginTop: scaleSpacing(Space[4]) }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
});

export default Input;

const styles = StyleSheet.create({
  container: {},
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    minHeight: Layout.minTouchTarget,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.regular,
  },
  toggle: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingLeft: 8,
  },
});
