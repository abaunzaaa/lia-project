import React from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAccessibility } from '../../context/AccessibilityContext';
import { Radius } from '../../theme/tokens';
import { useMedicationFormColors } from './useMedicationFormColors';

export const MED_FORM_KEYBOARD_ACCESSORY_ID = 'lia-medication-form-check';

type Props = {
  visible?: boolean;
  keyboardHeight?: number;
};

export default function KeyboardCheckBar({ visible }: Props) {
  const palette = useMedicationFormColors();
  const { minTouch } = useAccessibility();

  const bar = (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: palette.ice,
          borderTopColor: palette.border,
        },
      ]}
    >
      <View style={{ flex: 1 }} />
      <Pressable
        onPress={() => Keyboard.dismiss()}
        accessibilityRole="button"
        accessibilityLabel="Listo"
        accessibilityHint="Cierra el teclado"
        style={[
          styles.check,
          {
            minWidth: Math.max(56, minTouch),
            minHeight: Math.max(48, minTouch),
            backgroundColor: palette.navy,
          },
        ]}
      >
        <Ionicons name="checkmark" size={28} color={palette.onPrimary} />
      </Pressable>
    </View>
  );

  if (Platform.OS === 'ios') {
    return (
      <InputAccessoryView nativeID={MED_FORM_KEYBOARD_ACCESSORY_ID}>{bar}</InputAccessoryView>
    );
  }

  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={styles.androidWrap}>
      {bar}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  check: {
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  androidWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
  },
});
