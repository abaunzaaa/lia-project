import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

type Props = {
  testID: string;
  aspectRatio: number;
  style?: ViewStyle;
};

/** Reserva visual vacía para una ilustración 3D. Sin texto, iconos ni emojis. */
export default function HistoryImagePlaceholder({ testID, aspectRatio, style }: Props) {
  return (
    <View
      testID={testID}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.box, { aspectRatio }, style]}
    />
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    backgroundColor: 'transparent',
  },
});
