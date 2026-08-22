import React from 'react';
import { View } from 'react-native';
import { Space } from '../theme/tokens';
import { useAccessibility } from '../context/AccessibilityContext';
import AppText from './AppText';
import EditorialText from './EditorialText';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  editorial?: boolean;
}

export default function SectionHeader({ title, subtitle, editorial = false }: SectionHeaderProps) {
  const { scaleSpacing, scaleFont } = useAccessibility();

  return (
    <View style={{ marginBottom: scaleSpacing(Space[12]) }}>
      {editorial ? (
        <EditorialText
          variant="subhead"
          style={{ fontSize: scaleFont(22), lineHeight: scaleFont(28) }}
        >
          {title}
        </EditorialText>
      ) : (
        <AppText variant="h3">{title}</AppText>
      )}
      {subtitle ? (
        <AppText variant="body" tone="secondary" style={{ marginTop: scaleSpacing(Space[4]) }}>
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}
