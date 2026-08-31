import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../AppText';
import { useAccessibility } from '../../context/AccessibilityContext';
import { useResponsive } from '../../hooks/useResponsive';
import { Space } from '../../theme/tokens';
import { useMedicationFormColors } from './useMedicationFormColors';

type Props = {
  step: 1 | 2 | 3;
  flowTitle?: string;
  title: string;
  subtitle: string;
  onBack: () => void;
};

const STEP_LABELS = ['Datos', 'Horario', 'Resumen'] as const;

export default function MedicationFormHeader({
  step,
  flowTitle = 'Agregar medicamento',
  title,
  subtitle,
  onBack,
}: Props) {
  const insets = useSafeAreaInsets();
  const { minTouch, scaleSpacing, scaleFont } = useAccessibility();
  const { horizontalPadding } = useResponsive();
  const palette = useMedicationFormColors();

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + scaleSpacing(Space[8]),
          paddingHorizontal: horizontalPadding,
          backgroundColor: palette.page,
        },
      ]}
    >
      <View style={styles.titleRow}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={8}
          style={{
            minWidth: Math.max(48, minTouch),
            minHeight: Math.max(48, minTouch),
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: -8,
          }}
        >
          <Ionicons name="chevron-back" size={26} color={palette.navy} />
        </Pressable>
        <AppText
          variant="h2"
          style={{
            flex: 1,
            color: palette.navy,
            fontWeight: '700',
            fontSize: scaleFont(22),
          }}
        >
          {flowTitle}
        </AppText>
      </View>

      <View
        style={styles.stepper}
        accessibilityRole="progressbar"
        accessibilityLabel={`Paso ${step} de 3`}
        accessibilityValue={{ min: 1, max: 3, now: step }}
      >
        {STEP_LABELS.map((label, index) => {
          const n = (index + 1) as 1 | 2 | 3;
          const done = step > n;
          const current = step === n;
          const nodeBg = done || current ? palette.navy : palette.ice;
          const nodeFg = done || current ? palette.onPrimary : palette.secondary;
          const nodeBorder = current ? palette.teal : done ? palette.navy : palette.border;
          return (
            <React.Fragment key={label}>
              {index > 0 ? (
                <View
                  style={[
                    styles.connector,
                    { backgroundColor: step > index ? palette.navy : palette.pastel },
                  ]}
                />
              ) : null}
              <View style={styles.nodeCol}>
                <View
                  style={[
                    styles.node,
                    {
                      backgroundColor: nodeBg,
                      borderColor: nodeBorder,
                      transform: [{ scale: current ? 1.06 : 1 }],
                    },
                  ]}
                >
                  {done ? (
                    <Ionicons name="checkmark" size={14} color={palette.onPrimary} />
                  ) : (
                    <AppText
                      variant="caption"
                      style={{ color: nodeFg, fontWeight: '700', fontSize: scaleFont(13) }}
                    >
                      {n}
                    </AppText>
                  )}
                </View>
                <AppText
                  variant="caption"
                  style={{
                    color: current || done ? palette.navy : palette.secondary,
                    fontWeight: current ? '700' : '600',
                    marginTop: 6,
                    fontSize: scaleFont(11),
                  }}
                >
                  {label}
                </AppText>
              </View>
            </React.Fragment>
          );
        })}
      </View>

      <AppText
        variant="h1"
        accessibilityRole="header"
        style={{
          color: palette.navy,
          fontWeight: '700',
          fontSize: scaleFont(26),
          marginTop: scaleSpacing(Space[20]),
        }}
      >
        {title}
      </AppText>
      <AppText
        variant="body"
        style={{
          color: palette.secondary,
          marginTop: scaleSpacing(Space[8]),
          marginBottom: scaleSpacing(Space[8]),
        }}
      >
        {subtitle}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 4,
  },
  nodeCol: {
    alignItems: 'center',
    width: 64,
  },
  node: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    flex: 1,
    height: 3,
    borderRadius: 99,
    marginTop: 12,
    marginHorizontal: -4,
  },
});
