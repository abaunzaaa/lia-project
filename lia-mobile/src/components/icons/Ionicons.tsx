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
const frame = iconPaths.frame;
const origin = frame?.min ?? 0;
const side = frame?.side ?? iconPaths.units;

function shiftPath(d: string, by: number): string {
  if (by === 0) return d;
  return d.replace(/-?\d+(?:\.\d+)?/g, (token) => String(Number(token) + by));
}

const shiftedPaths = Object.fromEntries(
  Object.entries(paths).map(([name, d]) => [name, shiftPath(d, -origin)])
);

/**
 * Los mismos símbolos de Ionicons, dibujados con sus contornos.
 * El trazo real llega hasta 578 y también un poco por debajo de 0.
 * Un viewBox de 512 deja esos puntos fuera y en iOS el símbolo puede no pintarse.
 * Estirar el alto por encima de `size` lo corta la fila que lo contiene.
 * El marco es un cuadrado común, los puntos se corren para que empiece en 0,
 * y el hueco del ícono sigue siendo exactamente `size`.
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
    const d = shiftedPaths[name];
    return (
      <View
        {...rest}
        collapsable={false}
        pointerEvents="none"
        style={[style, { width: size, height: size, overflow: 'hidden', backgroundColor: 'transparent' }]}
      >
        {d ? (
          <Svg width={size} height={size} viewBox={`0 0 ${side} ${side}`}>
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
