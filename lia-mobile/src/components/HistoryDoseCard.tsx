import React from 'react';
import { View, Pressable, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HistoryEntry, Medication } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { BrandColors } from '../theme/brand';
import { Space } from '../theme/tokens';
import { formatTimeForDisplay } from '../utils/dateTime';
import { HistoryImages } from '../utils/historyAssets';
import { HistoryPalette, statusCopy, statusTone } from '../utils/historyUi';
import AppText from './AppText';

type Props = {
  item: HistoryEntry;
  onDelete: (entry: HistoryEntry) => void;
  deleting?: boolean;
  onOpen?: (medication: Medication) => void;
  medication?: Medication | null;
  showOpen?: boolean;
};

export default function HistoryDoseCard({
  item,
  onDelete,
  deleting = false,
  onOpen,
  medication,
  showOpen = false,
}: Props) {
  const { colors, isHighContrast, isDark } = useTheme();
  const { scaleFont, scaleSpacing, minTouch } = useAccessibility();
  const lightChrome = !isDark && !isHighContrast;
  const tone = statusTone(item.status, isHighContrast, isDark, colors);
  const status = statusCopy(item.status);
  const name = item.medicationName?.trim() || 'Medicamento';
  const dose = item.dose?.trim() || '';
  const ink = lightChrome ? HistoryPalette.navyDark : colors.textPrimary;
  const muted = lightChrome ? HistoryPalette.muted : colors.textSecondary;
  const cardBg = lightChrome ? HistoryPalette.white : colors.surface;
  const canOpen = showOpen && !!medication && !!onOpen;
  const trashSize = Math.min(32, Math.max(26, scaleFont(30)));

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor: isHighContrast ? colors.border : 'transparent',
          borderWidth: isHighContrast ? 2 : 0,
          paddingVertical: scaleSpacing(Space[16]),
          paddingHorizontal: scaleSpacing(Space[16]),
          marginBottom: scaleSpacing(Space[12]),
          shadowOpacity: lightChrome ? 0.06 : 0,
          elevation: lightChrome ? 2 : 0,
        },
      ]}
      accessibilityLabel={`${formatTimeForDisplay(item.time)}, ${name}${dose ? `, ${dose}` : ''}, ${status.label}`}
    >
      <View style={styles.row}>
        <Image
          source={HistoryImages.clock}
          style={styles.clock}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />

        <View style={styles.copy}>
          <AppText
            variant="h3"
            style={{
              color: ink,
              fontWeight: '600',
              fontSize: scaleFont(18),
              lineHeight: scaleFont(24),
              marginBottom: 2,
            }}
          >
            {formatTimeForDisplay(item.time)}
          </AppText>
          <AppText variant="body" style={{ color: ink, fontWeight: '600', flexShrink: 1 }}>
            {name}
          </AppText>
          {dose ? (
            <AppText variant="caption" style={{ color: muted, marginTop: 2, flexShrink: 1 }}>
              {dose}
            </AppText>
          ) : null}
        </View>

        <View style={styles.meta}>
          <View
            style={[
              styles.pill,
              {
                backgroundColor: isHighContrast ? colors.surface : tone.bg,
                borderColor: isHighContrast ? colors.border : 'transparent',
                borderWidth: isHighContrast ? 1 : 0,
              },
            ]}
          >
            <AppText variant="caption" style={{ color: tone.fg, fontWeight: '600', flexShrink: 1 }}>
              {status.label}
            </AppText>
          </View>

          {canOpen && medication ? (
            <Pressable
              onPress={() => onOpen?.(medication)}
              accessibilityRole="button"
              accessibilityLabel={`Ver información de ${name}`}
              hitSlop={8}
              style={({ pressed }) => [
                styles.iconBtn,
                { minWidth: minTouch, minHeight: minTouch, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="chevron-forward" size={20} color={muted} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => onDelete(item)}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel="Eliminar registro"
            accessibilityHint="Muestra una confirmación antes de quitar esta toma del historial"
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                minWidth: minTouch,
                minHeight: minTouch,
                opacity: deleting ? 1 : pressed ? 0.7 : 1,
              },
            ]}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={lightChrome ? BrandColors.navy : colors.primary} />
            ) : (
              <Image
                source={HistoryImages.trash}
                style={{ width: trashSize, height: trashSize }}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 22,
    shadowColor: '#245C86',
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clock: {
    width: 44,
    height: 44,
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  meta: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 140,
  },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
