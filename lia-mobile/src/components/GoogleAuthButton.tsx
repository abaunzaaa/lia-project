import React from 'react';
import { Image, Pressable, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { BrandColors } from '../theme/brand';
import { FontFamily, FontWeight, Radius } from '../theme/tokens';
import AppText from './AppText';

const GOOGLE_G = require('../assets/images/google-g.png');
const ICON_SIZE = 22;

type Props = {
  title: string;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

export default function GoogleAuthButton({
  title,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
}: Props) {
  const { colors, isDark, isHighContrast } = useTheme();
  const { minTouch } = useAccessibility();
  const lightChrome = !isDark && !isHighContrast;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: false }}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: Math.max(minTouch, 56),
          backgroundColor: lightChrome ? '#FFFFFF' : colors.surface,
          borderColor: lightChrome ? '#F0F1F2' : colors.border,
          opacity: pressed ? 0.88 : 1,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        <Image
          source={GOOGLE_G}
          style={styles.icon}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <AppText
          variant="button"
          style={{
            color: lightChrome ? BrandColors.navy : colors.textPrimary,
            fontFamily: FontFamily.semiBold,
            fontWeight: FontWeight.semiBold,
          }}
        >
          {title}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
});
