import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Space } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { BrandColors } from '../theme/brand';
import AppText from './AppText';
import EditorialText from './EditorialText';
import Button from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon = 'file-tray-outline',
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { colors, isHighContrast, isDark } = useTheme();
  const { scaleSpacing, scaleFont } = useAccessibility();

  return (
    <View
      style={[styles.wrap, { padding: scaleSpacing(Space[32]) }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${title}. ${description}`}
    >
      {!isHighContrast ? (
        <View
          pointerEvents="none"
          style={[
            styles.softGlow,
            {
              backgroundColor: isDark ? 'rgba(200,217,230,0.15)' : BrandColors.skyBlue,
              opacity: isDark ? 1 : 0.5,
            },
          ]}
        />
      ) : null}
      <View
        style={[
          styles.icon,
          {
            backgroundColor: isHighContrast ? colors.surface : isDark ? colors.accentSoft : BrandColors.skyBlue,
            borderWidth: isHighContrast ? 2 : 0,
            borderColor: colors.border,
            marginBottom: scaleSpacing(Space[20]),
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={scaleFont(28)}
          color={isHighContrast ? colors.textPrimary : isDark ? colors.primary : BrandColors.navy}
        />
      </View>
      <EditorialText
        variant="subhead"
        style={{
          textAlign: 'center',
          fontSize: scaleFont(24),
          lineHeight: scaleFont(30),
          marginBottom: scaleSpacing(Space[8]),
          flexShrink: 1,
        }}
      >
        {title}
      </EditorialText>
      <AppText
        variant="body"
        tone="secondary"
        style={{ textAlign: 'center', maxWidth: '100%', flexShrink: 1 }}
      >
        {description}
      </AppText>
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} style={{ marginTop: scaleSpacing(Space[24]) }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  softGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    top: '28%',
  },
  icon: {
    minWidth: 72,
    minHeight: 72,
    paddingHorizontal: 12,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
