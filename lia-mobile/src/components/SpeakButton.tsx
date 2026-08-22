import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { BrandColors, brandInk } from '../theme/brand';
import { Radius, Space } from '../theme/tokens';
import { useSpeech } from '../hooks/useSpeech';
import AppText from './AppText';
import Toast from './Toast';

interface SpeakButtonProps {
  /** Texto a leer, o función diferida. */
  text: string | (() => string);
  id: string;
  label?: string;
  stopLabel?: string;
  style?: ViewStyle;
  /** Si false, no se renderiza (además de voiceEnabled). */
  visible?: boolean;
}

/**
 * Control secundario refinado: Escuchar / Detener.
 * Solo visible cuando Lectura por voz está activa.
 */
export default function SpeakButton({
  text,
  id,
  label = 'Escuchar',
  stopLabel = 'Detener',
  style,
  visible = true,
}: SpeakButtonProps) {
  const { voiceEnabled, minTouch, scaleSpacing, scaleFont } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const { speaking, activeId, toggle, stop } = useSpeech();
  const [toast, setToast] = useState({ visible: false, message: '' });

  const isThis = speaking && activeId === id;
  const title = isThis ? stopLabel : label;

  const resolvedText = useMemo(() => {
    return typeof text === 'function' ? text : () => text;
  }, [text]);

  if (!voiceEnabled || !visible) return null;

  const onPress = async () => {
    try {
      if (isThis) {
        await stop();
        return;
      }
      const phrase = resolvedText().trim();
      if (!phrase) return;
      await toggle(phrase, id);
    } catch {
      setToast({
        visible: true,
        message: 'No pudimos reproducir la lectura en este momento.',
      });
    }
  };

  return (
    <>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={
          isThis
            ? 'Detiene la lectura en voz alta'
            : 'Lee esta información en voz alta'
        }
        accessibilityState={{ busy: isThis }}
        style={({ pressed }) => [
          styles.btn,
          {
            minHeight: minTouch,
            paddingHorizontal: scaleSpacing(Space[12]),
            paddingVertical: scaleSpacing(Space[8]),
            gap: scaleSpacing(Space[8]),
            backgroundColor: isHighContrast
              ? colors.surface
              : isDark
                ? 'rgba(200, 217, 230, 0.16)'
                : BrandColors.skyBlue,
            borderWidth: isHighContrast ? 2 : 1,
            borderColor: isHighContrast ? colors.border : colors.border,
            opacity: pressed ? 0.85 : 1,
          },
          style,
        ]}
      >
        <Ionicons
          name={isThis ? 'stop-circle-outline' : 'volume-high-outline'}
          size={scaleFont(20)}
          color={brandInk(isDark, isHighContrast, colors.textPrimary)}
        />
          <AppText
            variant="body"
            style={{
              fontWeight: '600',
              color: brandInk(isDark, isHighContrast, colors.textPrimary),
              flexShrink: 1,
              minWidth: 0,
            }}
            numberOfLines={2}
          >
          {title}
        </AppText>
      </Pressable>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type="error"
        onHide={() => setToast({ visible: false, message: '' })}
      />
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: Radius.lg,
    maxWidth: '100%',
  },
});
