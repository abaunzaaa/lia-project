import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  FlatList,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { BrandColors } from '../theme/brand';
import { Radius, Space } from '../theme/tokens';
import AppText from './AppText';

export type PickerOption = {
  value: string;
  label: string;
};

type Props = {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selectedValue?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
};

export default function OptionPickerModal({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors, isHighContrast, isDark } = useTheme();
  const { scaleSpacing, minTouch, scaleFont } = useAccessibility();

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.sheet,
                {
                  backgroundColor: isHighContrast
                    ? colors.surface
                    : isDark
                      ? colors.surfaceElevated
                      : BrandColors.white,
                  paddingBottom: Math.max(insets.bottom, scaleSpacing(Space[16])),
                  maxHeight: '70%',
                },
              ]}
            >
              <View style={styles.handleRow}>
                <View
                  style={[
                    styles.handle,
                    { backgroundColor: isHighContrast ? colors.border : BrandColors.skyBlue },
                  ]}
                />
              </View>
              <AppText
                variant="h3"
                style={{
                  marginBottom: scaleSpacing(Space[12]),
                  paddingHorizontal: scaleSpacing(Space[20]),
                }}
              >
                {title}
              </AppText>
              <FlatList
                data={options}
                keyExtractor={(item) => item.value}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const selected = item.value === selectedValue;
                  return (
                    <Pressable
                      onPress={() => {
                        onSelect(item.value);
                        onClose();
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={item.label}
                      style={({ pressed }) => [
                        styles.row,
                        {
                          minHeight: minTouch,
                          paddingHorizontal: scaleSpacing(Space[20]),
                          backgroundColor: selected
                            ? isHighContrast
                              ? colors.surface
                              : BrandColors.skyBlue
                            : 'transparent',
                          opacity: pressed ? 0.88 : 1,
                          borderBottomColor: colors.border,
                        },
                      ]}
                    >
                      <AppText
                        variant="body"
                        style={{
                          flex: 1,
                          flexShrink: 1,
                          fontWeight: selected ? '700' : '400',
                          fontSize: scaleFont(17),
                        }}
                      >
                        {item.label}
                      </AppText>
                      {selected ? (
                        <Ionicons
                          name="checkmark"
                          size={scaleFont(22)}
                          color={isHighContrast ? colors.textPrimary : BrandColors.navy}
                        />
                      ) : null}
                    </Pressable>
                  );
                }}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Space[8],
  },
  handleRow: {
    alignItems: 'center',
    marginBottom: Space[8],
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
});
