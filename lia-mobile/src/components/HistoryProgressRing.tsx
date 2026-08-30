import React from 'react';
import { View, StyleSheet } from 'react-native';

type Props = {
  progress: number;
  size: number;
  thickness?: number;
  color: string;
  trackColor: string;
  holeColor: string;
  children?: React.ReactNode;
};

/** Anillo circular nativo (sin librería de gráficas). `progress` de 0 a 1. */
export default function HistoryProgressRing({
  progress,
  size,
  thickness = 8,
  color,
  trackColor,
  holeColor,
  children,
}: Props) {
  const p = Math.max(0, Math.min(1, progress));
  const half = size / 2;
  const first = Math.min(p, 0.5) / 0.5;
  const second = p > 0.5 ? (p - 0.5) / 0.5 : 0;

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(p * 100),
      }}
    >
      <View
        style={[
          styles.track,
          {
            width: size,
            height: size,
            borderRadius: half,
            borderWidth: thickness,
            borderColor: trackColor,
          },
        ]}
      />

      <View style={[styles.halfClip, { width: half, height: size }]}>
        <View
          style={{
            width: size,
            height: size,
            borderRadius: half,
            borderWidth: thickness,
            borderColor: 'transparent',
            borderTopColor: color,
            borderRightColor: color,
            transform: [{ rotate: `${-135 + first * 180}deg` }],
          }}
        />
      </View>

      <View style={[styles.halfClip, { width: half, height: size, left: half }]}>
        <View
          style={{
            width: size,
            height: size,
            marginLeft: -half,
            borderRadius: half,
            borderWidth: thickness,
            borderColor: 'transparent',
            borderTopColor: color,
            borderRightColor: color,
            opacity: second > 0 ? 1 : 0,
            transform: [{ rotate: `${-135 + 180 + second * 180}deg` }],
          }}
        />
      </View>

      <View
        style={{
          position: 'absolute',
          top: thickness,
          left: thickness,
          width: size - thickness * 2,
          height: size - thickness * 2,
          borderRadius: (size - thickness * 2) / 2,
          backgroundColor: holeColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  halfClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
});
