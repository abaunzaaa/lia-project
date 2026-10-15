import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useAccessibility } from '../../context/AccessibilityContext';
import { useTheme } from '../../context/ThemeContext';
import { BrandColors, liaCardBorder } from '../../theme/brand';
import { FontFamily, FontWeight, Radius, Space } from '../../theme/tokens';
import AppText from '../AppText';
import SpeakButton from '../SpeakButton';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import {
  identifiedCheckAsset,
  identifiedMedicineAsset,
} from './identificationResultAssets';

type Props = {
  name: string;
  purpose: string | null;
  activeIngredient: string | null;
  importantPoints: string[];
  source: string | null;
  imageUrl?: string | null;
  speakId: string;
  speakText: string;
};

export default function IdentificationResultCard({
  name,
  purpose,
  activeIngredient,
  importantPoints,
  source,
  imageUrl,
  speakId,
  speakText,
}: Props) {
  const { scaleSpacing, scaleFont } = useAccessibility();
  const { colors, isDark, isHighContrast, shadows } = useTheme();
  const lightChrome = !isDark && !isHighContrast;
  const ink = lightChrome ? BrandColors.navy : colors.textPrimary;
  const muted = lightChrome ? BrandColors.teal : colors.textSecondary;
  const teal = lightChrome ? BrandColors.teal : colors.secondary;
  const displayName = name.trim() ? name : 'Medicamento identificado';
  const capturedUri = resolveMediaUrl(imageUrl);

  return (
    <View
      style={[
        styles.card,
        shadows.md,
        {
          backgroundColor: isHighContrast
            ? colors.surface
            : isDark
              ? colors.surfaceElevated
              : BrandColors.white,
          borderColor: isHighContrast ? colors.border : liaCardBorder(lightChrome, colors.border),
          borderWidth: isHighContrast ? 2 : 1,
          padding: scaleSpacing(Space[20]),
        },
      ]}
    >
      {capturedUri ? (
        <Image
          source={{ uri: capturedUri }}
          style={[
            styles.capturedPhoto,
            { marginBottom: scaleSpacing(Space[12]), borderRadius: Radius.lg },
          ]}
          resizeMode="cover"
          accessibilityLabel="Foto tomada por la cámara LÍA"
          accessibilityIgnoresInvertColors
        />
      ) : null}

      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <View style={styles.badgeRow}>
            <Image
              source={identifiedCheckAsset}
              style={styles.check}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
              accessible={false}
            />
            <AppText
              variant="overline"
              style={{
                color: teal,
                fontFamily: FontFamily.semiBold,
                fontWeight: FontWeight.semiBold,
                letterSpacing: 1.4,
                flexShrink: 1,
              }}
            >
              MEDICAMENTO IDENTIFICADO
            </AppText>
          </View>

          <AppText
            variant="h3"
            style={{
              color: ink,
              fontFamily: FontFamily.semiBold,
              fontWeight: FontWeight.semiBold,
              marginTop: scaleSpacing(Space[8]),
              flexShrink: 1,
            }}
          >
            {displayName}
          </AppText>

          {activeIngredient ? (
            <AppText
              variant="body"
              style={{ color: muted, marginTop: scaleSpacing(Space[4]), flexShrink: 1 }}
            >
              {`Principio activo: ${activeIngredient}`}
            </AppText>
          ) : null}
        </View>

        {capturedUri ? null : (
          <Image
            source={identifiedMedicineAsset}
            style={styles.art}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            accessible={false}
          />
        )}
      </View>

      <View
        style={[
          styles.divider,
          {
            backgroundColor: isHighContrast ? colors.border : lightChrome ? BrandColors.skyBlue : colors.border,
            marginVertical: scaleSpacing(Space[16]),
          },
        ]}
      />

      {purpose ? (
        <View>
          <AppText
            variant="body"
            style={{
              color: ink,
              fontFamily: FontFamily.semiBold,
              fontWeight: FontWeight.semiBold,
              marginBottom: scaleSpacing(Space[8]),
              flexShrink: 1,
            }}
          >
            ¿Para qué se utiliza?
          </AppText>
          <AppText
            variant="body"
            style={{
              color: muted,
              fontSize: scaleFont(16),
              lineHeight: scaleFont(24),
              flexShrink: 1,
            }}
          >
            {purpose}
          </AppText>
        </View>
      ) : null}

      {importantPoints.length > 0 ? (
        <View style={{ marginTop: scaleSpacing(Space[12]), gap: scaleSpacing(Space[8]) }}>
          <AppText variant="label" style={{ color: ink }}>
            Puntos importantes
          </AppText>
          {importantPoints.slice(0, 4).map((point, index) => (
            <AppText
              key={`${index}-${point.slice(0, 12)}`}
              variant="body"
              style={{ color: muted, flexShrink: 1 }}
            >
              {`· ${point}`}
            </AppText>
          ))}
        </View>
      ) : null}

      {source ? (
        <AppText variant="caption" tone="muted" style={{ marginTop: scaleSpacing(Space[12]) }}>
          {source}
        </AppText>
      ) : null}

      {speakText ? (
        <SpeakButton
          id={speakId}
          layout="identification"
          label="Escuchar"
          stopLabel="Detener"
          text={speakText}
          style={{ marginTop: scaleSpacing(Space[16]) }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: 'visible',
    width: '100%',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    paddingTop: 4,
  },
  art: {
    width: 92,
    height: 92,
    marginTop: -28,
    marginRight: -4,
    backgroundColor: 'transparent',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  check: {
    width: 22,
    height: 22,
    backgroundColor: 'transparent',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  capturedPhoto: {
    width: '100%',
    height: 180,
    backgroundColor: '#EAF3F7',
  },
});
