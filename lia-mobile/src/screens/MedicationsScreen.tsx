import React, { useMemo, useState } from 'react';
import { View, Pressable, StyleSheet, FlatList, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList, MainTabParamList, Medication } from '../types';
import {
  AppText,
  AppModal,
  EmptyState,
  MedicationCard,
  Toast,
} from '../components';
import { useMedications, MedicationApiError } from '../context/MedicationContext';
import { useReminders } from '../context/ReminderContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors } from '../theme/brand';
import { FontFamily, FontWeight, Radius, Space } from '../theme/tokens';
import { formatTimeForDisplay } from '../utils/dateTime';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Medications'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type Props = { navigation: NavProp };

type MedSort = 'newest' | 'oldest';

const MED_SUMMARY_ICON = require('../assets/images/iconomed.png');

const SORTS: { id: MedSort; label: string }[] = [
  { id: 'newest', label: 'Últimos registros' },
  { id: 'oldest', label: 'Registros más antiguos' },
];

function createdAtMs(value?: string): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function MedicationsScreen({ navigation }: Props) {
  const { medications, loading, removeMedication } = useMedications();
  const { todayReminders, invalidateAfterMedicationChange } = useReminders();
  const { scaleSpacing, scaleFont, minTouch } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const { horizontalPadding, contentMaxWidth, isTablet, isSmallPhone } = useResponsive();
  const insets = useSafeAreaInsets();
  const lightChrome = !isDark && !isHighContrast;

  const [deleteTarget, setDeleteTarget] = useState<Medication | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [medSort, setMedSort] = useState<MedSort>('newest');
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error';
  }>({ visible: false, message: '', type: 'success' });

  const reminderView = useMemo(() => {
    const map: Record<string, { missed: number; nextTime: string | null }> = {};
    medications.forEach((med) => {
      const missedReminders = todayReminders.filter(
        (r) => r.medicationId === med.id && r.status === 'missed'
      );
      const nextPending = todayReminders
        .filter((r) => r.medicationId === med.id && r.status === 'pending')
        .slice()
        .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))[0];
      const nextTimeRaw = nextPending?.scheduledTime || med.time || null;
      map[med.id] = {
        missed: missedReminders.length,
        nextTime: nextTimeRaw ? formatTimeForDisplay(nextTimeRaw) : null,
      };
    });
    return map;
  }, [medications, todayReminders]);

  const sortedMedications = useMemo(() => {
    const list = medications.slice();
    list.sort((a, b) => {
      const delta = createdAtMs(a.createdAt) - createdAtMs(b.createdAt);
      return medSort === 'newest' ? -delta : delta;
    });
    return list;
  }, [medications, medSort]);

  const numColumns = isTablet && sortedMedications.length > 1 ? 2 : 1;

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await removeMedication(deleteTarget.id);
      await invalidateAfterMedicationChange();
      setDeleteTarget(null);
      setToast({ visible: true, message: 'Medicamento eliminado.', type: 'success' });
    } catch (e) {
      const message =
        e instanceof MedicationApiError || e instanceof Error
          ? e.message
          : 'No pudimos completar la acción. Inténtalo nuevamente.';
      setToast({ visible: true, message, type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const goToAdd = () => navigation.navigate('AddMedication', {});

  const summaryArtSize = isTablet ? 156 : isSmallPhone ? 108 : 132;
  const summaryArtOverflowTop = 8;
  const summaryArtShiftRight = isSmallPhone ? 8 : 12;

  const screenTitle = (
    <View style={styles.headerRow}>
      <AppText
        variant="h1"
        accessibilityRole="header"
        style={{
          color: lightChrome ? BrandColors.navy : colors.textPrimary,
          fontSize: scaleFont(26),
          lineHeight: scaleFont(32),
          letterSpacing: -0.2,
          fontWeight: '600',
          flexShrink: 1,
        }}
      >
        Tus medicamentos
      </AppText>
    </View>
  );

  const fabSize = Math.max(56, minTouch);
  const titleSafePad = {
    paddingTop: insets.top + scaleSpacing(Space[8]),
    paddingHorizontal: horizontalPadding,
    paddingBottom: scaleSpacing(Space[4]),
  };

  return (
    <View style={[styles.container, { backgroundColor: lightChrome ? '#FFFFFF' : colors.background }]}>
      {loading ? (
        <>
          <View style={titleSafePad}>{screenTitle}</View>
          <View style={styles.loadingWrap} accessibilityLabel="Cargando medicamentos">
            <ActivityIndicator size="large" color={colors.primary} />
            <AppText variant="body" tone="secondary" style={{ marginTop: scaleSpacing(Space[16]) }}>
              Cargando tus medicamentos…
            </AppText>
          </View>
        </>
      ) : medications.length === 0 ? (
        <>
          <View style={titleSafePad}>{screenTitle}</View>
          <EmptyState
            icon="medkit-outline"
            title="Aún no tienes medicamentos"
            description="Cuando agregues el primero, LIA te ayudará a organizar cada toma con calma."
            actionLabel="Agregar medicamento"
            onAction={goToAdd}
          />
        </>
      ) : (
        <FlatList
          key={`cols-${numColumns}-${medSort}`}
          data={sortedMedications}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          columnWrapperStyle={numColumns > 1 ? { gap: scaleSpacing(Space[12]) } : undefined}
          removeClippedSubviews={false}
          style={styles.listOverflow}
          CellRendererComponent={({ style, children, onLayout }) => (
            <View style={[style, styles.listOverflow]} onLayout={onLayout}>
              {children}
            </View>
          )}
          contentContainerStyle={[
            styles.list,
            {
              paddingHorizontal: horizontalPadding,
              paddingTop: insets.top + scaleSpacing(Space[8]),
              maxWidth: contentMaxWidth,
              alignSelf: 'center',
              width: '100%',
              paddingBottom: scaleSpacing(Space[40]) + fabSize + scaleSpacing(Space[16]),
            },
          ]}
          ListHeaderComponent={
            <View>
              <View style={{ paddingBottom: scaleSpacing(Space[12]) }}>{screenTitle}</View>
              <View
                style={{
                  marginBottom: scaleSpacing(Space[16]),
                  paddingTop: summaryArtOverflowTop,
                  overflow: 'visible',
                }}
              >
              <View style={styles.summaryStage}>
                <View
                  style={[
                    styles.summaryCard,
                    {
                      backgroundColor: isHighContrast
                        ? colors.surface
                        : isDark
                          ? colors.surfaceElevated
                          : '#D6E8F5',
                      borderColor: isHighContrast ? colors.border : 'transparent',
                      borderWidth: isHighContrast ? 2 : 0,
                      paddingRight: Math.max(72, Math.round(summaryArtSize * 0.36)),
                    },
                  ]}
                >
                  <View
                    accessible
                    accessibilityRole="text"
                    accessibilityLabel={`${medications.length} registrados. ¿Tienes medicamentos nuevos?`}
                  >
                    <AppText
                      variant="bodyLarge"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                      style={{
                        color: lightChrome ? BrandColors.teal : colors.textSecondary,
                        fontFamily: FontFamily.regular,
                        fontWeight: FontWeight.regular,
                        fontSize: scaleFont(18),
                        lineHeight: scaleFont(24),
                        letterSpacing: 0.1,
                      }}
                    >
                      {`${medications.length} Registrados`}
                    </AppText>
                    <AppText
                      variant="caption"
                      numberOfLines={2}
                      style={{
                        marginTop: 6,
                        color: lightChrome ? BrandColors.teal : colors.textSecondary,
                        fontFamily: FontFamily.regular,
                        fontWeight: FontWeight.regular,
                        fontSize: scaleFont(14),
                        lineHeight: scaleFont(20),
                      }}
                    >
                      ¿Tienes medicamentos nuevos?
                    </AppText>
                  </View>
                  <Pressable
                    onPress={goToAdd}
                    accessibilityRole="button"
                    accessibilityLabel="Agregar medicamento"
                    accessibilityHint="Abre el formulario para registrar un medicamento"
                    style={({ pressed }) => [
                      styles.summaryAddBtn,
                      {
                        minHeight: Math.min(minTouch, 40),
                        backgroundColor: lightChrome ? BrandColors.navy : colors.primary,
                        borderRadius: Radius.lg,
                        borderWidth: isHighContrast ? 2 : 0,
                        borderColor: colors.border,
                        opacity: pressed ? 0.88 : 1,
                      },
                    ]}
                  >
                    <AppText
                      variant="button"
                      numberOfLines={1}
                      style={{
                        color: BrandColors.white,
                        fontFamily: FontFamily.semiBold,
                        fontWeight: FontWeight.semiBold,
                        textAlign: 'center',
                      }}
                    >
                      Agregar medicamento
                    </AppText>
                  </Pressable>
                </View>
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    width: summaryArtSize,
                    height: summaryArtSize,
                    top: 2,
                    right: summaryArtShiftRight,
                    zIndex: 1,
                    elevation: 2,
                  }}
                >
                  <Image
                    source={MED_SUMMARY_ICON}
                    style={{ width: summaryArtSize, height: summaryArtSize }}
                    resizeMode="contain"
                    accessibilityIgnoresInvertColors
                  />
                </View>
              </View>

              <View
                style={[
                  styles.filterRow,
                  { gap: scaleSpacing(Space[8]), marginTop: scaleSpacing(Space[24]) },
                ]}
              >
                {SORTS.map((item) => {
                  const selected = medSort === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setMedSort(item.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={item.label}
                      style={({ pressed }) => [
                        styles.filterChip,
                        {
                          backgroundColor: selected
                            ? isHighContrast
                              ? colors.textPrimary
                              : isDark
                                ? colors.primary
                                : BrandColors.navy
                            : lightChrome
                              ? '#FFFFFF'
                              : colors.surface,
                          borderColor: selected
                            ? isHighContrast
                              ? colors.border
                              : BrandColors.navy
                            : isHighContrast
                              ? colors.border
                              : '#F0F1F2',
                          borderWidth: isHighContrast ? 2 : 1,
                          opacity: pressed ? 0.88 : 1,
                        },
                      ]}
                    >
                      <AppText
                        variant="caption"
                        style={{
                          color: selected
                            ? isHighContrast
                              ? colors.background
                              : BrandColors.white
                            : lightChrome
                              ? BrandColors.navy
                              : colors.textPrimary,
                          fontFamily: FontFamily.medium,
                          fontWeight: FontWeight.medium,
                        }}
                      >
                        {item.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            </View>
          }
          renderItem={({ item }) => (
            <View style={{ flex: numColumns > 1 ? 1 : undefined, minWidth: 0 }}>
              <MedicationCard
                medication={item}
                nextTime={reminderView[item.id]?.nextTime}
                missed={reminderView[item.id]?.missed ?? 0}
                onPress={() => navigation.navigate('MedicationDetail', { medication: item })}
                onEdit={() => navigation.navigate('EditMedication', { medication: item })}
                onDelete={() => setDeleteTarget(item)}
                showActions
              />
            </View>
          )}
        />
      )}

      {!loading ? (
        <Pressable
          onPress={goToAdd}
          accessibilityRole="button"
          accessibilityLabel="Agregar medicamento"
          accessibilityHint="Abre el formulario para registrar un medicamento"
          style={({ pressed }) => [
            styles.fab,
            {
              width: fabSize,
              height: fabSize,
              borderRadius: fabSize / 2,
              right: horizontalPadding,
              bottom: scaleSpacing(Space[20]),
              backgroundColor: lightChrome ? BrandColors.navy : colors.primary,
              borderWidth: isHighContrast ? 2 : 0,
              borderColor: colors.border,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
        >
          <Ionicons name="add" size={scaleFont(26)} color={BrandColors.white} />
        </Pressable>
      ) : null}

      <AppModal
        visible={!!deleteTarget}
        title="¿Eliminar este medicamento?"
        message="Se quitará de tus medicamentos activos, pero tu historial se conservará."
        confirmText={deleting ? 'Eliminando…' : 'Eliminar'}
        cancelText="Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        destructive
      />

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryStage: {
    position: 'relative',
    overflow: 'visible',
  },
  summaryCard: {
    width: '100%',
    minHeight: 112,
    overflow: 'visible',
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: '#D6E8F5',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 2,
  },
  summaryAddBtn: {
    alignSelf: 'flex-start',
    marginTop: 12,
    minWidth: 168,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listOverflow: {
    overflow: 'visible',
  },
  list: { flexGrow: 1 },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  fab: {
    position: 'absolute',
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2F4156',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 8,
  },
});
