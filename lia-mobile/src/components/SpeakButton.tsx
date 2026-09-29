import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { BrandColors, brandInk } from '../theme/brand';
import { FontFamily, FontWeight, Radius, Space } from '../theme/tokens';
import { useSpeech } from '../hooks/useSpeech';
import AppText from './AppText';
import Toast from './Toast';
import { listenSpeakerAsset } from './identification-result/identificationResultAssets';

interface SpeakButtonProps {
  /** Texto a leer, o función diferida. */
  text: string | (() => string);
  id: string;
  label?: string;
  stopLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** Si false, no se renderiza (además de voiceEnabled). */
  visible?: boolean;
  /** Variante tipográfica del texto. Por defecto body. */
  textVariant?: 'body' | 'label' | 'button';
  /** Más compacto visualmente; la zona de toque se conserva con hitSlop. */
  compact?: boolean;
  /** Solo cambia el aspecto. La reproducción usa el mismo TTS. */
  layout?: 'default' | 'identification';
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
  textVariant = 'body',
  compact = false,
  layout = 'default',
}: SpeakButtonProps) {
  const { voiceEnabled, minTouch, scaleSpacing, scaleFont } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const { speaking, activeId, toggle, stop } = useSpeech();
  const [toast, setToast] = useState({ visible: false, message: '' });

  const isThis = speaking && activeId === id;
  const title = isThis ? stopLabel : label;
  const identification = layout === 'identification';

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

  const a11yLabel = identification
    ? isThis
      ? stopLabel
      : 'Escuchar explicación del medicamento'
    : title;

  return (
    <>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityHint={
          isThis
            ? 'Detiene la lectura en voz alta'
            : 'Lee esta información en voz alta'
        }
        accessibilityState={{ busy: isThis, selected: isThis }}
        hitSlop={
          compact && !identification
            ? { top: 8, bottom: 8, left: 6, right: 6 }
            : undefined
        }
        style={({ pressed }) =>
          identification
            ? [
                styles.identificationRow,
                {
                  minHeight: Math.max(56, minTouch),
                  paddingHorizontal: scaleSpacing(Space[12]),
                  paddingVertical: scaleSpacing(Space[8]),
                  backgroundColor: isHighContrast
                    ? colors.surface
                    : isDark
                      ? colors.surfaceElevated
                      : colors.primaryLight,
                  borderWidth: isHighContrast ? 2 : 0,
                  borderColor: colors.border,
                  opacity: pressed ? 0.88 : 1,
                },
                style,
              ]
            : [
                styles.btn,
                {
                  minHeight: compact ? 36 : minTouch,
                  paddingHorizontal: scaleSpacing(compact ? Space[8] : Space[12]),
                  paddingVertical: scaleSpacing(compact ? Space[4] : Space[8]),
                  gap: scaleSpacing(compact ? Space[4] : Space[8]),
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
              ]
        }
      >
        {identification ? (
          <>
            <Image
              source={listenSpeakerAsset}
              style={styles.speaker}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
              accessible={false}
            />
            <View style={styles.identificationCopy}>
              <AppText
                variant="body"
                style={{
                  fontFamily: FontFamily.semiBold,
                  fontWeight: FontWeight.semiBold,
                  color: brandInk(isDark, isHighContrast, colors.textPrimary),
                  flexShrink: 1,
                }}
              >
                {title}
              </AppText>
              <AppText
                variant="caption"
                style={{
                  color: isHighContrast ? colors.textSecondary : isDark ? colors.textSecondary : BrandColors.teal,
                  marginTop: 2,
                  flexShrink: 1,
                }}
              >
                Oír la explicación
              </AppText>
            </View>
            <View
              style={[
                styles.play,
                {
                  width: Math.max(44, minTouch * 0.85),
                  height: Math.max(44, minTouch * 0.85),
                  backgroundColor: isHighContrast ? colors.primary : colors.primary,
                },
              ]}
            >
              <Ionicons
                name={isThis ? 'stop' : 'play'}
                size={scaleFont(18)}
                color={colors.onPrimary}
              />
            </View>
          </>
        ) : (
          <>
            <Ionicons
              name={isThis ? 'stop-circle-outline' : 'volume-high-outline'}
              size={scaleFont(textVariant === 'body' ? 20 : 16)}
              color={brandInk(isDark, isHighContrast, colors.textPrimary)}
            />
            <AppText
              variant={textVariant}
              style={{
                fontFamily: FontFamily.semiBold,
                fontWeight: FontWeight.semiBold,
                textAlign: 'center',
                color: brandInk(isDark, isHighContrast, colors.textPrimary),
                flexShrink: 1,
                minWidth: 0,
              }}
              numberOfLines={1}
            >
              {title}
            </AppText>
          </>
        )}
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
  identificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: Radius.lg,
    gap: 10,
    maxWidth: '100%',
  },
  speaker: {
    width: 40,
    height: 40,
    backgroundColor: 'transparent',
  },
  identificationCopy: {
    flex: 1,
    minWidth: 0,
  },
  play: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
