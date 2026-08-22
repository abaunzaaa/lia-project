import React from 'react';
import { Modal, View, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { Radius, Space } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { useResponsive } from '../hooks/useResponsive';
import AppText from './AppText';
import Button from './Button';

interface ModalProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export default function AppModal({
  visible,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  destructive = false,
}: ModalProps) {
  const { colors, shadows } = useTheme();
  const { scaleSpacing, isSeniorMode } = useAccessibility();
  const { width, contentMaxWidth } = useResponsive();
  const modalWidth = Math.min(width - scaleSpacing(48), contentMaxWidth, 360);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={[styles.overlay, { backgroundColor: colors.overlay, padding: scaleSpacing(Space[24]) }]}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.container,
                shadows.lg,
                {
                  backgroundColor: colors.surfaceElevated,
                  padding: scaleSpacing(Space[24]),
                  maxWidth: modalWidth,
                },
              ]}
            >
              <AppText variant="h3" style={{ textAlign: 'center' }}>
                {title}
              </AppText>
              {message ? (
                <AppText variant="body" tone="secondary" style={{ textAlign: 'center', marginTop: scaleSpacing(Space[8]), marginBottom: scaleSpacing(Space[20]) }}>
                  {message}
                </AppText>
              ) : null}
              <View
                style={[
                  styles.actions,
                  {
                    gap: scaleSpacing(Space[8]),
                    flexDirection: isSeniorMode ? 'column' : 'row',
                  },
                ]}
              >
                <Button
                  title={cancelText}
                  variant="ghost"
                  size="md"
                  onPress={onCancel}
                  style={isSeniorMode ? styles.btnStack : styles.btn}
                />
                {onConfirm ? (
                  <Button
                    title={confirmText}
                    size="md"
                    onPress={onConfirm}
                    style={[
                      isSeniorMode ? styles.btnStack : styles.btn,
                      destructive && { backgroundColor: colors.error },
                    ]}
                  />
                ) : null}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    borderRadius: Radius.xl,
    width: '100%',
  },
  actions: {
    flexDirection: 'row',
  },
  btn: {
    flex: 1,
  },
  btnStack: {
    alignSelf: 'stretch',
  },
});
