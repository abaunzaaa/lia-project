import React from 'react';
import { View, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAccessibility } from '../../context/AccessibilityContext';
import { FontFamily, FontWeight, Layout, Space } from '../../theme/tokens';
import { brandAccent, brandInk } from '../../theme/brand';
import AppText from '../AppText';
import { GRANDFATHER_ASPECT, LIA_THINKING_GRANDFATHER } from './chatAssets';

type Props = {
  onBack: () => void;
  medicationName: string;
  registeredDose?: string;
};

export default function AskLiaHeader({ onBack, medicationName, registeredDose }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, isDark, isHighContrast } = useTheme();
  const { scaleFont, scaleSpacing, minTouch } = useAccessibility();
  const ink = brandInk(isDark, isHighContrast, colors.textPrimary);
  const accent = brandAccent(isDark, isHighContrast, colors.primary, colors.textPrimary);
  const titleSize = scaleFont(26);
  const headerFill = isHighContrast ? colors.surfaceElevated : colors.accentSoft;

  return (
    <View>
      <View
        style={[
          styles.banner,
          {
            paddingTop: insets.top + scaleSpacing(Space[4]),
            paddingHorizontal: scaleSpacing(Space[16]),
            paddingBottom: scaleSpacing(28),
            backgroundColor: headerFill,
          },
        ]}
      >
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={8}
          style={({ pressed }) => [
            styles.back,
            {
              minWidth: minTouch,
              minHeight: minTouch,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons name="chevron-back" size={26} color={ink} />
        </Pressable>

        <View style={[styles.row, { gap: scaleSpacing(12) }]}>
          <View style={styles.headerTextContent}>
            <AppText
              variant="h1"
              textBreakStrategy="simple"
              android_hyphenationFrequency="none"
              style={{
                color: ink,
                fontFamily: FontFamily.semiBold,
                fontWeight: FontWeight.semiBold,
                fontSize: titleSize,
                lineHeight: Math.round(titleSize * 1.22),
              }}
            >
              Preguntar a LIA
            </AppText>
            <AppText
              variant="body"
              textBreakStrategy="simple"
              android_hyphenationFrequency="none"
              style={{
                color: accent,
                fontFamily: FontFamily.medium,
                fontWeight: FontWeight.medium,
                fontSize: scaleFont(18),
                lineHeight: scaleFont(24),
                marginTop: scaleSpacing(8),
              }}
            >
              {`Sobre ${medicationName}`}
            </AppText>
            {registeredDose ? (
              <AppText
                variant="caption"
                tone="secondary"
                style={{
                  fontFamily: FontFamily.regular,
                  fontSize: scaleFont(14),
                  lineHeight: scaleFont(20),
                  marginTop: scaleSpacing(6),
                }}
              >
                {`Registrado: ${registeredDose}.`}
              </AppText>
            ) : null}
          </View>

          <View
            style={styles.art}
            pointerEvents="none"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Image
              source={LIA_THINKING_GRANDFATHER}
              style={styles.artImage}
              resizeMode="contain"
              accessible={false}
              accessibilityIgnoresInvertColors
            />
          </View>
        </View>
      </View>

      <View
        pointerEvents="none"
        style={[
          styles.curve,
          { backgroundColor: colors.background },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    overflow: 'hidden',
  },
  curve: {
    height: 22,
    marginTop: -22,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
  },
  back: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    minWidth: Layout.minTouchTarget,
    minHeight: Layout.minTouchTarget,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minWidth: 0,
    minHeight: 148,
  },
  headerTextContent: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  art: {
    width: '42%',
    maxWidth: 176,
    minWidth: 132,
    flexShrink: 0,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  artImage: {
    width: '100%',
    maxWidth: 176,
    height: undefined,
    maxHeight: 188,
    aspectRatio: GRANDFATHER_ASPECT,
    backgroundColor: 'transparent',
  },
});
