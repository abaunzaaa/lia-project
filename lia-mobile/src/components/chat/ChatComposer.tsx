import React from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAccessibility } from '../../context/AccessibilityContext';
import { BrandColors, brandInk } from '../../theme/brand';
import { FontFamily, Layout, Space } from '../../theme/tokens';
import AppText from '../AppText';
import { CHAT_HAIRLINE } from './chatAssets';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  canSend: boolean;
  sending: boolean;
  maxLength: number;
  nearLimit: boolean;
  placeholder: string;
  accessibilityLabel: string;
  bottomInset: number;
};

export default function ChatComposer({
  value,
  onChangeText,
  onSend,
  canSend,
  sending,
  maxLength,
  nearLimit,
  placeholder,
  accessibilityLabel,
  bottomInset,
}: Props) {
  const { colors, isDark, isHighContrast } = useTheme();
  const { scaleFont, scaleSpacing, minTouch } = useAccessibility();
  const lightChrome = !isDark && !isHighContrast;
  const ink = brandInk(isDark, isHighContrast, colors.textPrimary);
  const sendSize = Math.max(minTouch, 48);

  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom: bottomInset,
          paddingTop: scaleSpacing(Space[8]),
          backgroundColor: colors.background,
        },
      ]}
    >
      <View style={styles.row}>
        <View
          style={[
            styles.shell,
            {
              backgroundColor: lightChrome ? BrandColors.white : colors.surface,
              borderColor: lightChrome ? CHAT_HAIRLINE : colors.border,
              borderWidth: isHighContrast ? 2 : 1,
              minHeight: Math.max(minTouch, 56),
            },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              {
                fontFamily: FontFamily.regular,
                fontSize: scaleFont(16),
                color: ink,
                maxHeight: scaleFont(16) * 5,
              },
            ]}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            value={value}
            onChangeText={onChangeText}
            multiline
            editable={!sending}
            maxLength={maxLength}
            accessibilityLabel={accessibilityLabel}
          />
        </View>
        <Pressable
          onPress={onSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          accessibilityHint="Envía tu pregunta a LIA"
          accessibilityState={{ disabled: !canSend, busy: sending }}
          style={({ pressed }) => [
            styles.send,
            {
              width: sendSize,
              height: sendSize,
              minWidth: minTouch,
              minHeight: minTouch,
              backgroundColor: canSend
                ? isHighContrast
                  ? colors.textPrimary
                  : isDark
                    ? colors.primary
                    : BrandColors.navy
                : colors.border,
              opacity: pressed && canSend ? 0.88 : 1,
            },
          ]}
        >
          <Ionicons
            name="send-outline"
            size={scaleFont(18)}
            color={
              canSend
                ? isHighContrast
                  ? colors.background
                  : isDark
                    ? colors.onPrimary
                    : BrandColors.white
                : colors.textMuted
            }
          />
        </Pressable>
      </View>
      {nearLimit ? (
        <AppText variant="caption" tone="muted" style={styles.counter}>
          {`${value.length}/${maxLength}`}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  shell: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    justifyContent: 'center',
    minWidth: 0,
    minHeight: Layout.minTouchTarget,
  },
  input: {
    paddingVertical: 12,
    minWidth: 0,
  },
  send: {
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  counter: {
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 4,
  },
});
