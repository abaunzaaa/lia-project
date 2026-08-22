import React from 'react';
import { View, Switch, StyleSheet } from 'react-native';
import { Space, Layout } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import AppText from './AppText';

interface AccessibilityToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityHint?: string;
}

export default function AccessibilityToggle({
  label,
  description,
  value,
  onValueChange,
  accessibilityHint,
}: AccessibilityToggleProps) {
  const { colors } = useTheme();
  const { minTouch, scaleSpacing, isSeniorMode } = useAccessibility();

  return (
    <View
      style={[
        styles.row,
        isSeniorMode && styles.stack,
        { minHeight: minTouch, gap: scaleSpacing(Space[12]) },
      ]}
      accessible
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint ?? description}
      accessibilityState={{ checked: value }}
    >
      <View style={styles.copy}>
        <AppText variant="body" style={{ fontWeight: '600' }}>
          {label}
        </AppText>
        {description ? (
          <AppText variant="caption" tone="secondary" style={{ marginTop: 4 }}>
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.surfaceElevated}
        ios_backgroundColor={colors.border}
        pointerEvents="box-only"
        focusable={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Layout.minTouchTarget,
  },
  stack: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    width: '100%',
  },
});
