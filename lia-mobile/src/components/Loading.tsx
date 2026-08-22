import React from 'react';
import { View, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import { Radius, Space } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import AppText from './AppText';

interface LoadingProps {
  visible?: boolean;
  message?: string;
  fullScreen?: boolean;
}

export default function Loading({ visible = true, message = 'Cargando...', fullScreen = false }: LoadingProps) {
  const { colors } = useTheme();
  const { scaleSpacing } = useAccessibility();

  if (!visible) return null;

  const content = (
    <View
      style={[
        styles.content,
        {
          backgroundColor: colors.surfaceElevated,
          padding: scaleSpacing(Space[32]),
          gap: scaleSpacing(Space[16]),
        },
      ]}
    >
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? <AppText variant="body" tone="secondary">{message}</AppText> : null}
    </View>
  );

  if (fullScreen) {
    return (
      <Modal transparent visible={visible} animationType="fade">
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>{content}</View>
      </Modal>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    borderRadius: Radius.lg,
    alignItems: 'center',
    minWidth: 160,
  },
});
