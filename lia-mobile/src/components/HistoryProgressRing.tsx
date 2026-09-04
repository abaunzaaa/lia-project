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

const SEGMENTS = 72;

/** Anillo 0–100 %: cada segmento es 1/72 del círculo, de las 12 en punto hacia la derecha. */
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
  const filled = Math.round(p * SEGMENTS);
  const angle = 360 / SEGMENTS;
  const tickWidth = Math.max(2, thickness * 0.72);
  const inner = size - thickness * 2;

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
      {Array.from({ length: SEGMENTS }, (_, index) => (
        <View
          key={index}
          pointerEvents="none"
          style={[
            styles.spoke,
            {
              width: size,
              height: size,
              transform: [{ rotate: `${index * angle}deg` }],
            },
          ]}
        >
          <View
            style={{
              width: tickWidth,
              height: thickness,
              borderRadius: tickWidth / 2,
              backgroundColor: index < filled ? color : trackColor,
            }}
          />
        </View>
      ))}

      <View
        style={{
          position: 'absolute',
          top: thickness,
          left: thickness,
          width: inner,
          height: inner,
          borderRadius: inner / 2,
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
  spoke: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
  },
});
