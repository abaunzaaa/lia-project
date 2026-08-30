import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types';
import {
  AppText,
  EditorialText,
  Header,
  Screen,
  SurfaceCard,
} from '../components';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors } from '../theme/brand';
import { Radius, Space } from '../theme/tokens';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ScanMedication'>;
};

export default function ScanMedicationScreen({ navigation }: Props) {
  const { scaleSpacing, scaleFont, minTouch } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const lightChrome = !isDark && !isHighContrast;
  const { compact } = useResponsive();

  const cardBg = isHighContrast
    ? colors.surface
    : isDark
      ? colors.surfaceElevated
      : BrandColors.white;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {!isHighContrast ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View
            style={[
              styles.arc,
              {
                borderColor: BrandColors.skyBlue,
                opacity: isDark ? 0.22 : 0.5,
              },
            ]}
          />
        </View>
      ) : null}

      <Header title="Identificar" showBack onBack={() => navigation.goBack()} editorial />

      <Screen scroll padded contentStyle={{ paddingBottom: scaleSpacing(Space[40]) }}>
        <EditorialText
          variant="headline"
          accessibilityRole="header"
          style={{
            fontSize: scaleFont(compact ? 28 : 32),
            lineHeight: scaleFont(compact ? 34 : 38),
            marginBottom: scaleSpacing(Space[8]),
          }}
        >
          Identifica tu medicamento
        </EditorialText>

        <AppText
          variant="body"
          tone="secondary"
          style={{
            marginBottom: scaleSpacing(Space[24]),
            maxWidth: 420,
            flexShrink: 1,
          }}
        >
          Elige cómo quieres identificarlo: con la cámara LIA o buscando el nombre.
        </AppText>

        <SurfaceCard
          variant="default"
          style={{
            marginBottom: scaleSpacing(Space[16]),
            backgroundColor: isHighContrast
              ? colors.surface
              : isDark
                ? colors.surfaceElevated
                : BrandColors.skyBlue,
            overflow: 'hidden',
          }}
        >
          {!isHighContrast ? (
            <View
              pointerEvents="none"
              style={[
                styles.cardHalo,
                {
                  backgroundColor: isDark ? BrandColors.navy : BrandColors.white,
                  opacity: isDark ? 0.4 : 0.5,
                },
              ]}
            />
          ) : null}

          <View style={styles.pathHeader}>
            <View
              style={[
                styles.pathIcon,
                {
                  backgroundColor: isHighContrast ? colors.surface : BrandColors.navy,
                  borderWidth: isHighContrast ? 1 : 0,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons
                name="camera-outline"
                size={scaleFont(24)}
                color={isHighContrast ? colors.textPrimary : BrandColors.white}
              />
            </View>
            <View style={styles.pathText}>
              <AppText variant="medicationName" style={{ flexShrink: 1 }}>
                Cámara LIA
              </AppText>
              <AppText
                variant="body"
                tone="secondary"
                style={{ marginTop: 4, flexShrink: 1 }}
              >
                Te guiamos para usar la cámara física.
              </AppText>
            </View>
          </View>

          <Pressable
            onPress={() => navigation.navigate('CameraGuide')}
            accessibilityRole="button"
            accessibilityLabel="Ver instrucciones de la cámara LIA"
            accessibilityHint="Abre la guía paso a paso para usar el dispositivo físico"
            style={({ pressed }) => [
              styles.pathCta,
              {
                minHeight: minTouch,
                backgroundColor: isHighContrast ? colors.surface : BrandColors.navy,
                borderWidth: isHighContrast ? 2 : 0,
                borderColor: colors.border,
                opacity: pressed ? 0.88 : 1,
                marginTop: scaleSpacing(Space[16]),
              },
            ]}
          >
            <AppText
              variant="label"
              style={{
                color: isHighContrast ? colors.textPrimary : BrandColors.white,
              }}
            >
              Ver instrucciones
            </AppText>
            <Ionicons
              name="arrow-forward"
              size={scaleFont(18)}
              color={isHighContrast ? colors.textPrimary : BrandColors.white}
            />
          </Pressable>
        </SurfaceCard>

        <SurfaceCard
          variant="default"
          style={{
            backgroundColor: cardBg,
            borderWidth: isHighContrast ? 2 : 1,
            borderColor: lightChrome ? BrandColors.skyBlue : colors.border,
          }}
        >
          <View style={styles.pathHeader}>
            <View
              style={[
                styles.pathIcon,
                {
                  backgroundColor: isHighContrast ? colors.surface : BrandColors.skyBlue,
                  borderWidth: isHighContrast ? 1 : 0,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons
                name="search-outline"
                size={scaleFont(24)}
                color={isHighContrast ? colors.textPrimary : BrandColors.navy}
              />
            </View>
            <View style={styles.pathText}>
              <AppText variant="medicationName" style={{ flexShrink: 1 }}>
                Identificar manualmente
              </AppText>
              <AppText
                variant="body"
                tone="secondary"
                style={{ marginTop: 4, flexShrink: 1 }}
              >
                Busca el medicamento por su nombre.
              </AppText>
            </View>
          </View>

          <Pressable
            onPress={() => navigation.navigate('DrugSearch')}
            accessibilityRole="button"
            accessibilityLabel="Buscar medicamento"
            accessibilityHint="Abre la búsqueda farmacológica por nombre"
            style={({ pressed }) => [
              styles.pathCta,
              {
                minHeight: minTouch,
                backgroundColor: isHighContrast ? colors.surface : BrandColors.teal,
                borderWidth: isHighContrast ? 2 : 0,
                borderColor: colors.border,
                opacity: pressed ? 0.88 : 1,
                marginTop: scaleSpacing(Space[16]),
              },
            ]}
          >
            <AppText
              variant="label"
              style={{
                color: isHighContrast ? colors.textPrimary : BrandColors.white,
              }}
            >
              Buscar medicamento
            </AppText>
            <Ionicons
              name="arrow-forward"
              size={scaleFont(18)}
              color={isHighContrast ? colors.textPrimary : BrandColors.white}
            />
          </Pressable>
        </SurfaceCard>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  arc: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
    top: -60,
    right: -70,
    backgroundColor: 'transparent',
  },
  cardHalo: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    top: -36,
    right: -28,
  },
  pathHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    width: '100%',
  },
  pathIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pathText: {
    flex: 1,
    minWidth: 0,
  },
  pathCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: Radius.lg,
    paddingHorizontal: Space[16],
    width: '100%',
  },
});
