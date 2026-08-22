import React, { useState } from 'react';
import { View, Pressable, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList, MainTabParamList, Medication } from '../types';
import {
  AppText,
  AppModal,
  EmptyState,
  Header,
  MedicationCard,
  Toast,
} from '../components';
import { useMedications, MedicationApiError } from '../context/MedicationContext';
import { useReminders } from '../context/ReminderContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors } from '../theme/brand';
import { Radius, Space } from '../theme/tokens';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Medications'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type Props = { navigation: NavProp };

export default function MedicationsScreen({ navigation }: Props) {
  const { medications, loading, removeMedication } = useMedications();
  const { invalidateAfterMedicationChange } = useReminders();
  const { scaleSpacing, minTouch, scaleFont } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const { horizontalPadding, contentMaxWidth, isTablet } = useResponsive();

  const [deleteTarget, setDeleteTarget] = useState<Medication | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error';
  }>({ visible: false, message: '', type: 'success' });

  const numColumns = isTablet && medications.length > 1 ? 2 : 1;
  const subtitle = loading
    ? 'Cargando…'
    : medications.length === 0
      ? 'Tu listado personal'
      : `${medications.length} ${medications.length === 1 ? 'registrado' : 'registrados'}`;

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Tus medicamentos"
        subtitle={subtitle}
        rightAction={
          <Pressable
            onPress={() => navigation.navigate('AddMedication', {})}
            accessibilityRole="button"
            accessibilityLabel="Agregar medicamento"
            style={[
              styles.addBtn,
              {
                minWidth: minTouch,
                minHeight: minTouch,
                backgroundColor: isHighContrast ? colors.surface : BrandColors.navy,
                borderWidth: isHighContrast ? 2 : 0,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons
              name="add"
              size={scaleFont(24)}
              color={isHighContrast ? colors.textPrimary : BrandColors.white}
            />
          </Pressable>
        }
      />

      {loading ? (
        <View style={styles.loadingWrap} accessibilityLabel="Cargando medicamentos">
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText variant="body" tone="secondary" style={{ marginTop: scaleSpacing(Space[16]) }}>
            Cargando tus medicamentos…
          </AppText>
        </View>
      ) : medications.length === 0 ? (
        <EmptyState
          icon="medkit-outline"
          title="Aún no tienes medicamentos"
          description="Cuando agregues el primero, LIA te ayudará a organizar cada toma con calma."
          actionLabel="Agregar medicamento"
          onAction={() => navigation.navigate('AddMedication', {})}
        />
      ) : (
        <FlatList
          key={`cols-${numColumns}`}
          data={medications}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          columnWrapperStyle={numColumns > 1 ? { gap: scaleSpacing(Space[12]) } : undefined}
          contentContainerStyle={[
            styles.list,
            {
              paddingHorizontal: horizontalPadding,
              maxWidth: contentMaxWidth,
              alignSelf: 'center',
              width: '100%',
              paddingBottom: scaleSpacing(Space[40]),
            },
          ]}
          renderItem={({ item }) => (
            <View style={{ flex: numColumns > 1 ? 1 : undefined, minWidth: 0 }}>
              <MedicationCard
                medication={item}
                onPress={() => navigation.navigate('MedicationDetail', { medication: item })}
                onEdit={() => navigation.navigate('EditMedication', { medication: item })}
                onDelete={() => setDeleteTarget(item)}
                showActions
              />
            </View>
          )}
          ListFooterComponent={
            <Pressable
              onPress={() => navigation.navigate('AddMedication', {})}
              accessibilityRole="button"
              accessibilityLabel="Agregar medicamento"
              style={({ pressed }) => [
                styles.addRow,
                {
                  minHeight: minTouch,
                  borderColor: isHighContrast ? colors.border : BrandColors.skyBlue,
                  backgroundColor: isDark ? colors.surface : BrandColors.white,
                  opacity: pressed ? 0.85 : 1,
                  marginTop: scaleSpacing(Space[8]),
                },
              ]}
            >
              <Ionicons
                name="add-circle-outline"
                size={scaleFont(22)}
                color={isHighContrast ? colors.textPrimary : isDark ? colors.primary : BrandColors.navy}
              />
              <AppText variant="body" style={{ fontWeight: '600', marginLeft: 8, flexShrink: 1 }}>
                Agregar medicamento
              </AppText>
            </Pressable>
          }
        />
      )}

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
  list: { flexGrow: 1 },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  addBtn: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    borderStyle: 'dashed',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
});
