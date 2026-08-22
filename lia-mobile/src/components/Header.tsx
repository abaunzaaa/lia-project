import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout, Space } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { useResponsive } from '../hooks/useResponsive';
import AppText from './AppText';
import EditorialText from './EditorialText';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  /** Título serif editorial (identidad LIA) */
  editorial?: boolean;
  /** Alineación del bloque de título */
  align?: 'center' | 'left';
  style?: ViewStyle;
}

export default function Header({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  editorial = true,
  align = 'left',
  style,
}: HeaderProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { minTouch, scaleSpacing, scaleFont } = useAccessibility();
  const { horizontalPadding } = useResponsive();
  const isLeft = align === 'left';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + scaleSpacing(Space[8]),
          paddingHorizontal: horizontalPadding,
          paddingBottom: scaleSpacing(Space[16]),
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {showBack && onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={[styles.side, { minHeight: minTouch, minWidth: minTouch }]}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
        ) : null}

        <View
          style={[
            styles.titleContainer,
            isLeft && styles.titleLeft,
            showBack && onBack ? styles.titleWithBack : null,
          ]}
        >
          {title ? (
            editorial ? (
              <EditorialText
                variant="subhead"
                accessibilityRole="header"
                style={{
                  fontSize: scaleFont(26),
                  lineHeight: scaleFont(32),
                  textAlign: isLeft ? 'left' : 'center',
                  flexShrink: 1,
                }}
              >
                {title}
              </EditorialText>
            ) : (
              <AppText
                variant="h2"
                style={{ textAlign: isLeft ? 'left' : 'center', flexShrink: 1 }}
              >
                {title}
              </AppText>
            )
          ) : null}
          {subtitle ? (
            <AppText
              variant="body"
              tone="secondary"
              style={{
                textAlign: isLeft ? 'left' : 'center',
                marginTop: scaleSpacing(Space[4]),
                flexShrink: 1,
              }}
            >
              {subtitle}
            </AppText>
          ) : null}
        </View>

        {rightAction ? (
          <View style={[styles.side, styles.right, { minHeight: minTouch }]}>{rightAction}</View>
        ) : !isLeft ? (
          <View style={styles.side} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  side: {
    minWidth: Layout.minTouchTarget,
    minHeight: Layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  right: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
    paddingHorizontal: 4,
  },
  titleLeft: {
    alignItems: 'flex-start',
    paddingHorizontal: 0,
  },
  titleWithBack: {
    marginLeft: 4,
  },
});
