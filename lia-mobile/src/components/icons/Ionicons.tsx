import React from 'react';
import { StyleProp, View, ViewProps, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import glyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json';
import iconPaths from './iconPaths.json';

type IconName = keyof typeof glyphMap;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * Se acepta para no cambiar las llamadas existentes.
   * El tamaño ya llega calculado en `size`; el vector no usa la fuente del sistema.
   */
  allowFontScaling?: boolean;
  maxFontSizeMultiplier?: number;
} & Omit<ViewProps, 'style' | 'children'>;

const paths = iconPaths.icons as Record<string, string>;
const bottoms = iconPaths.bottom as Record<string, number>;

/**
 * Los mismos símbolos de Ionicons, dibujados con sus contornos.
 * En Expo Go con React Native 0.88 la fuente de íconos no se pinta de forma
 * estable: el nombre ionicons ya está registrado, y liaicons queda en blanco
 * según el peso, el alto de línea o la cara que pide iOS. Un vector no depende
 * de esa carga.
 */
const Ionicons = Object.assign(
  function Ionicons({
    name,
    size = 12,
    color = '#000000',
    style,
    allowFontScaling: _allowFontScaling,
    maxFontSizeMultiplier: _maxFontSizeMultiplier,
    ...rest
  }: Props) {
    const d = paths[name];
    const units = iconPaths.units;
    const viewBottom = bottoms[name] ?? units;
    const drawHeight = (size * viewBottom) / units;
    return (
      <View
        {...rest}
        pointerEvents="none"
        style={[
          style,
          { width: size, height: drawHeight, overflow: 'visible', backgroundColor: 'transparent' },
        ]}
      >
        {d ? (
          <Svg width={size} height={drawHeight} viewBox={`0 0 ${units} ${viewBottom}`}>
            <Path d={d} fill={color || '#000000'} />
          </Svg>
        ) : null}
      </View>
    );
  },
  { glyphMap }
);

export { Ionicons };
export default Ionicons;
