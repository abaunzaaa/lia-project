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

const IMAGE_BOX = 64;

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
  const cardWidth = fill ? '100%' : compact ? 112 : 120;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.card,
        {
          width: cardWidth,
          minHeight: Math.max(48, minTouch + 24),
          height: fill ? '100%' : undefined,
          backgroundColor: selected ? palette.ice : palette.card,
          borderColor: selected ? palette.navy : palette.border,
          borderWidth: selected || palette.isHighContrast ? 2 : 1,
          opacity: pressed ? 0.92 : 1,
          paddingVertical: scaleSpacing(Space[12]),
          paddingHorizontal: scaleSpacing(Space[8]),
        },
      ]}
    >
      {selected ? (
        <View style={[styles.check, { backgroundColor: palette.navy }]}>
          <Ionicons name="checkmark" size={12} color={palette.onPrimary} />
        </View>
      ) : null}
      <View style={styles.imageBox}>
        <Image
          source={image}
          style={styles.image}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
      <AppText
        variant="caption"
        numberOfLines={2}
        style={{
          color: palette.navy,
          fontWeight: '600',
          textAlign: 'center',
          fontSize: scaleFont(13),
          minHeight: scaleFont(32),
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
    gap: 8,
    position: 'relative',
  },
  imageBox: {
    width: IMAGE_BOX,
    height: IMAGE_BOX,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: IMAGE_BOX,
    height: IMAGE_BOX,
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
});
