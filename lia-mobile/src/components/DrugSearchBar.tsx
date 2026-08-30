import React from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily, Layout, Radius, Space } from '../theme/tokens';
import { BrandColors } from '../theme/brand';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import AppText from './AppText';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  searching: boolean;
  disabled?: boolean;
  error?: string;
};

export default function DrugSearchBar({
  value,
  onChangeText,
  onSubmit,
  searching,
  disabled = false,
  error,
}: Props) {
  const { colors, isHighContrast, isDark, shadows } = useTheme();
  const { scaleFont, scaleSpacing, minTouch } = useAccessibility();
  const lightChrome = !isDark && !isHighContrast;
  const btnSize = Math.max(minTouch, 52);
  const blocked = disabled || searching;

  const shellBg = lightChrome ? BrandColors.white : colors.surface;
  const searchBg = isHighContrast ? colors.surface : lightChrome ? BrandColors.navy : colors.primary;
  const searchFg = isHighContrast ? colors.textPrimary : lightChrome ? BrandColors.white : colors.onPrimary;
  const idleBorder = lightChrome ? BrandColors.skyBlue : colors.border;

  return (
    <View>
      <View
        style={[
          styles.shell,
          shadows.sm,
          {
            minHeight: Math.max(minTouch, 56),
            backgroundColor: shellBg,
            borderRadius: Radius.full,
            borderWidth: isHighContrast ? 2 : 1,
            borderColor: error ? colors.error : idleBorder,
            paddingLeft: scaleSpacing(Space[20]),
            paddingRight: scaleSpacing(Space[8]),
            paddingVertical: scaleSpacing(Space[8]),
          },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Ej. Acetaminofén"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          blurOnSubmit
          editable={!blocked}
          onSubmitEditing={() => {
            if (!blocked) onSubmit();
          }}
          accessibilityLabel="Nombre del medicamento"
          accessibilityHint="Escribe el nombre y pulsa buscar"
          accessibilityState={{ disabled: blocked }}
          style={[
            styles.input,
            {
              fontSize: scaleFont(16),
              lineHeight: scaleFont(24),
              color: colors.textPrimary,
              paddingVertical: Platform.OS === 'android' ? 8 : 10,
            },
          ]}
        />

        <Pressable
          onPress={onSubmit}
          disabled={blocked}
          accessibilityRole="button"
          accessibilityLabel="Buscar medicamento"
          accessibilityHint="Busca coincidencias con el nombre escrito"
          accessibilityState={{ disabled: blocked, busy: searching }}
          hitSlop={8}
          style={({ pressed }) => [
            styles.searchBtn,
            {
              width: btnSize,
              height: btnSize,
              minWidth: btnSize,
              minHeight: btnSize,
              backgroundColor: searchBg,
              borderWidth: isHighContrast ? 2 : 0,
              borderColor: colors.border,
              opacity: blocked ? 0.55 : pressed ? 0.88 : 1,
            },
          ]}
        >
          {searching ? (
            <ActivityIndicator color={searchFg} />
          ) : (
            <Ionicons name="search" size={scaleFont(20)} color={searchFg} />
          )}
        </Pressable>
      </View>

      {error ? (
        <AppText
          variant="body"
          tone="error"
          style={{
            marginTop: scaleSpacing(Space[8]),
          }}
        >
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: FontFamily.regular,
    paddingRight: 8,
  },
  searchBtn: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    minHeight: Layout.minTouchTarget,
    minWidth: Layout.minTouchTarget,
  },
});
