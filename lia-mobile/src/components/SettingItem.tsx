import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Space } from '../theme/tokens';
import { useAccessibility } from '../context/AccessibilityContext';
import AppText from './AppText';
import AccessibilityToggle from './AccessibilityToggle';

interface SettingItemProps {
  label: string;
  description?: string;
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  right?: React.ReactNode;
}

export default function SettingItem({
  label,
  description,
  value,
  onValueChange,
  right,
}: SettingItemProps) {
  const { scaleSpacing } = useAccessibility();

  if (typeof value === 'boolean' && onValueChange) {
    return (
      <AccessibilityToggle label={label} description={description} value={value} onValueChange={onValueChange} />
    );
  }

  return (
    <View style={[styles.row, { paddingVertical: scaleSpacing(Space[8]) }]}>
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
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copy: {
    flex: 1,
  },
});
