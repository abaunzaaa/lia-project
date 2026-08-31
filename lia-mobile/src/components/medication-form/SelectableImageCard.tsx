import React from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppText from '../AppText';
import { useAccessibility } from '../../context/AccessibilityContext';
import { Radius, Space } from '../../theme/tokens';
import { useMedicationFormColors } from './useMedicationFormColors';

type Props = {
  label: string;
  image: ImageSourcePropType;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  compact?: boolean;
  fill?: boolean;
};

export default function SelectableImageCard({
  label,
  image,
  selected,
  onPress,
  accessibilityLabel,
  compact,
  fill,
}: Props) {
  const { minTouch, scaleSpacing, scaleFont } = useAccessibility();
  const palette = useMedicationFormColors();
  const imageSize = compact ? 36 : 64;
  const cardWidth = fill ? '100%' : compact ? undefined : 120;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.card,
        compact ? styles.cardCompact : null,
        {
          width: cardWidth,
          minHeight: compact ? Math.max(72, minTouch + 8) : Math.max(48, minTouch + 24),
          backgroundColor: selected ? palette.ice : palette.card,
          borderColor: selected ? palette.navy : palette.border,
          borderWidth: selected || palette.isHighContrast ? 2 : 1,
          opacity: pressed ? 0.92 : 1,
          paddingVertical: scaleSpacing(compact ? Space[8] : Space[12]),
          paddingHorizontal: scaleSpacing(compact ? Space[4] : Space[8]),
          gap: compact ? 4 : 8,
        },
      ]}
    >
      {selected ? (
        <View
          style={[
            styles.check,
            compact ? styles.checkCompact : null,
            { backgroundColor: palette.navy },
          ]}
        >
          <Ionicons name="checkmark" size={compact ? 10 : 12} color={palette.onPrimary} />
        </View>
      ) : null}
      <View style={{ width: imageSize, height: imageSize, alignItems: 'center', justifyContent: 'center' }}>
        <Image
          source={image}
          style={{ width: imageSize, height: imageSize, backgroundColor: 'transparent' }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
      <AppText
        variant="caption"
        numberOfLines={compact ? 1 : 2}
        style={{
          color: palette.navy,
          fontWeight: '600',
          textAlign: 'center',
          fontSize: scaleFont(compact ? 12 : 13),
        }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  cardCompact: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  checkCompact: {
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
  },
});
