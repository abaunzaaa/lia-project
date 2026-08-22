import React from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Space } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { useResponsive } from '../hooks/useResponsive';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  keyboard?: boolean;
  safeTop?: boolean;
  transparent?: boolean;
  /** Ancho máximo custom; por defecto usa contentMaxWidth del breakpoint */
  maxWidth?: number;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

export default function Screen({
  children,
  scroll = false,
  padded = true,
  keyboard = false,
  safeTop = false,
  transparent = false,
  maxWidth: maxWidthProp,
  style,
  contentStyle,
}: ScreenProps) {
  const { colors } = useTheme();
  const { scaleSpacing } = useAccessibility();
  const { width, horizontalPadding, contentMaxWidth } = useResponsive();
  const insets = useSafeAreaInsets();

  const pad = padded ? horizontalPadding : 0;
  const maxWidth = Math.min(width, maxWidthProp ?? contentMaxWidth);

  const inner = (
    <View
      style={[
        styles.constrain,
        {
          maxWidth,
          paddingHorizontal: pad,
          paddingTop: safeTop ? insets.top + scaleSpacing(Space[8]) : 0,
          paddingBottom: scaleSpacing(Space[32]) + insets.bottom,
        },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      {inner}
    </ScrollView>
  ) : (
    inner
  );

  const wrapped = keyboard ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      {body}
    </KeyboardAvoidingView>
  ) : (
    body
  );

  return (
    <View
      style={[
        styles.flex,
        { backgroundColor: transparent ? 'transparent' : colors.background },
        style,
      ]}
    >
      {wrapped}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  constrain: {
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
  },
});
