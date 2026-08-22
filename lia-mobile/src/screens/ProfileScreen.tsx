import React, { useCallback, useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList, MainTabParamList } from '../types';
import { AppText, AppModal, Header, SurfaceCard, Toast } from '../components';
import { useAuth } from '../context/AuthContext';
import { useMedications } from '../context/MedicationContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors } from '../theme/brand';
import { Radius, Space } from '../theme/tokens';
import {
  disablePhoneReminders,
  enablePhoneReminders,
  getEffectivePhoneRemindersEnabled,
} from '../services/notificationService';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Profile'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type Props = { navigation: NavProp };

export default function ProfileScreen({ navigation }: Props) {
  const { user, logout, isDemo } = useAuth();
  const { medications } = useMedications();
  const { mode, toggleSeniorMode, scaleFont, scaleSpacing, minTouch } = useAccessibility();
  const { colors, isHighContrast } = useTheme();
  const { horizontalPadding, contentMaxWidth } = useResponsive();
  const [showLogout, setShowLogout] = useState(false);
  const [phoneRemindersOn, setPhoneRemindersOn] = useState(false);
  const [permissionDeniedHint, setPermissionDeniedHint] = useState(false);
  const [togglingReminders, setTogglingReminders] = useState(false);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ visible: false, message: '', type: 'info' });

  const refreshReminderState = useCallback(async () => {
    const state = await getEffectivePhoneRemindersEnabled();
    setPhoneRemindersOn(state.effective);
    setPermissionDeniedHint(state.preference && !state.permissionGranted);
  }, []);

  useEffect(() => {
    void refreshReminderState();
  }, [refreshReminderState, user?.uid, isDemo]);

  const handlePhoneRemindersToggle = (value: boolean) => {
    if (togglingReminders) return;

    if (isDemo) {
      setToast({
        visible: true,
        message: 'En modo demo no se programan recordatorios del teléfono.',
        type: 'info',
      });
      return;
    }

    if (!value) {
      setTogglingReminders(true);
      void (async () => {
        try {
          await disablePhoneReminders();
          setPhoneRemindersOn(false);
          setPermissionDeniedHint(false);
          setToast({
            visible: true,
            message: 'Recordatorios del teléfono desactivados.',
            type: 'success',
          });
        } finally {
          setTogglingReminders(false);
        }
      })();
      return;
    }

    Alert.alert(
      'Recordatorios del teléfono',
      'LIA puede avisarte a la hora de tus medicamentos aunque no estés usando la app. ¿Quieres activar las notificaciones?',
      [
        { text: 'Ahora no', style: 'cancel' },
        {
          text: 'Activar',
          onPress: () => {
            setTogglingReminders(true);
            void (async () => {
              try {
                const result = await enablePhoneReminders(medications, { isDemo: false });
                await refreshReminderState();
                if (!result.ok) {
                  setToast({
                    visible: true,
                    message: result.message || 'No pudimos activar los recordatorios del teléfono.',
                    type: 'error',
                  });
                } else {
                  setToast({
                    visible: true,
                    message: 'Recordatorios del teléfono activados.',
                    type: 'success',
                  });
                }
              } finally {
                setTogglingReminders(false);
              }
            })();
          },
        },
      ]
    );
  };

  const accountItems = [
    {
      icon: 'settings-outline' as const,
      label: 'Configuración',
      onPress: () => navigation.navigate('Settings'),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Tu perfil" subtitle={isDemo ? 'Modo demo' : undefined} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: horizontalPadding,
            maxWidth: contentMaxWidth,
            alignSelf: 'center',
            width: '100%',
            paddingBottom: scaleSpacing(Space[40]),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SurfaceCard variant="emphasis" style={{ alignItems: 'center', marginBottom: scaleSpacing(Space[24]) }}>
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: isHighContrast ? colors.surface : BrandColors.navy,
                borderWidth: isHighContrast ? 2 : 0,
                borderColor: colors.border,
                marginBottom: scaleSpacing(Space[16]),
              },
            ]}
          >
            <AppText
              variant="h1"
              style={{ color: isHighContrast ? colors.textPrimary : BrandColors.white }}
            >
              {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
            </AppText>
          </View>
          <AppText variant="h2" style={{ textAlign: 'center' }}>
            {user?.fullName || 'Usuario'}
          </AppText>
          <AppText
            variant="body"
            tone="secondary"
            style={{ marginTop: 4, textAlign: 'center', flexShrink: 1, maxWidth: '100%' }}
          >
            {user?.email}
          </AppText>
          {user?.age ? (
            <View
              style={[
                styles.ageBadge,
                {
                  backgroundColor: isHighContrast ? colors.surface : BrandColors.skyBlue,
                  borderWidth: isHighContrast ? 1 : 0,
                  borderColor: colors.border,
                  marginTop: scaleSpacing(Space[12]),
                },
              ]}
            >
              <AppText variant="caption" style={{ fontWeight: '600', color: BrandColors.navy }}>
                {user.age} años
              </AppText>
            </View>
          ) : null}
        </SurfaceCard>

        <AppText variant="overline" style={{ marginBottom: scaleSpacing(Space[8]) }}>
          Notificaciones
        </AppText>
        <View
          style={[
            styles.menuItem,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: isHighContrast ? 2 : 1,
              minHeight: Math.max(minTouch + 8, 56),
              padding: scaleSpacing(Space[16]),
              marginBottom: scaleSpacing(Space[8]),
            },
          ]}
          accessibilityRole="switch"
          accessibilityState={{ checked: phoneRemindersOn, disabled: togglingReminders || isDemo }}
          accessibilityLabel="Notificaciones de medicamentos"
        >
          <Ionicons
            name="notifications-outline"
            size={scaleFont(22)}
            color={isHighContrast ? colors.textPrimary : BrandColors.navy}
          />
          <View style={{ flex: 1, marginLeft: 12, minWidth: 0, marginRight: 8 }}>
            <AppText variant="body" style={{ fontWeight: '600', flexShrink: 1 }}>
              Notificaciones de medicamentos
            </AppText>
            <AppText variant="caption" tone="secondary" style={{ marginTop: 2, flexShrink: 1 }}>
              Avisos del teléfono a la hora de cada toma
            </AppText>
          </View>
          <Switch
            value={phoneRemindersOn}
            onValueChange={handlePhoneRemindersToggle}
            disabled={togglingReminders || isDemo}
            trackColor={{ false: colors.border, true: BrandColors.teal }}
            thumbColor={phoneRemindersOn ? BrandColors.navy : colors.surface}
            accessibilityLabel="Activar o desactivar notificaciones de medicamentos"
          />
        </View>
        {permissionDeniedHint ? (
          <AppText
            variant="caption"
            tone="secondary"
            style={{ marginBottom: scaleSpacing(Space[24]), flexShrink: 1 }}
          >
            Las notificaciones están desactivadas. Puedes activarlas desde la configuración de tu
            teléfono para que LIA pueda avisarte a tiempo.
          </AppText>
        ) : (
          <View style={{ marginBottom: scaleSpacing(Space[16]) }} />
        )}

        <AppText variant="overline" style={{ marginBottom: scaleSpacing(Space[8]) }}>
          Cuenta
        </AppText>
        <View style={{ gap: scaleSpacing(Space[8]), marginBottom: scaleSpacing(Space[24]) }}>
          {accountItems.map((item) => (
            <Pressable
              key={item.label}
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              style={({ pressed }) => [
                styles.menuItem,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: isHighContrast ? 2 : 1,
                  minHeight: Math.max(minTouch + 8, 56),
                  opacity: pressed ? 0.88 : 1,
                  padding: scaleSpacing(Space[16]),
                },
              ]}
            >
              <Ionicons
                name={item.icon}
                size={scaleFont(22)}
                color={isHighContrast ? colors.textPrimary : BrandColors.navy}
              />
              <AppText variant="body" style={{ flex: 1, fontWeight: '600', marginLeft: 12, flexShrink: 1 }}>
                {item.label}
              </AppText>
              <Ionicons name="chevron-forward" size={scaleFont(18)} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>

        <AppText variant="overline" style={{ marginBottom: scaleSpacing(Space[8]) }}>
          Accesibilidad
        </AppText>
        <Pressable
          onPress={toggleSeniorMode}
          accessibilityRole="switch"
          accessibilityState={{ checked: mode === 'senior' }}
          accessibilityLabel="Modo adulto mayor"
          style={[
            styles.menuItem,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: isHighContrast ? 2 : 1,
              minHeight: Math.max(minTouch + 8, 56),
              padding: scaleSpacing(Space[16]),
              marginBottom: scaleSpacing(Space[24]),
            },
          ]}
        >
          <Ionicons
            name="accessibility-outline"
            size={scaleFont(22)}
            color={isHighContrast ? colors.textPrimary : BrandColors.teal}
          />
          <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
            <AppText variant="body" style={{ fontWeight: '600' }}>
              Modo adulto mayor
            </AppText>
            <AppText variant="caption" tone="secondary" style={{ marginTop: 2 }}>
              Texto y botones más grandes
            </AppText>
          </View>
          <View
            style={[
              styles.toggle,
              {
                backgroundColor: mode === 'senior' ? BrandColors.navy : colors.border,
                justifyContent: mode === 'senior' ? 'flex-end' : 'flex-start',
              },
            ]}
          >
            <View style={[styles.toggleDot, { backgroundColor: BrandColors.white }]} />
          </View>
        </Pressable>

        {user?.emergencyContact ? (
          <>
            <AppText variant="overline" style={{ marginBottom: scaleSpacing(Space[8]) }}>
              Seguridad
            </AppText>
            <View
              style={[
                styles.menuItem,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: isHighContrast ? 2 : 1,
                  minHeight: Math.max(minTouch + 8, 56),
                  padding: scaleSpacing(Space[16]),
                  marginBottom: scaleSpacing(Space[24]),
                },
              ]}
              accessibilityLabel={`Contacto de emergencia: ${user.emergencyContact}`}
            >
              <Ionicons
                name="call-outline"
                size={scaleFont(22)}
                color={isHighContrast ? colors.textPrimary : BrandColors.teal}
              />
              <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                <AppText variant="body" style={{ fontWeight: '600' }}>
                  Contacto de emergencia
                </AppText>
                <AppText variant="caption" tone="secondary" style={{ marginTop: 2, flexShrink: 1 }}>
                  {user.emergencyContact}
                </AppText>
              </View>
            </View>
          </>
        ) : null}

        <Pressable
          onPress={() => setShowLogout(true)}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
          style={({ pressed }) => [
            styles.logoutBtn,
            {
              minHeight: minTouch,
              borderColor: colors.error,
              opacity: pressed ? 0.75 : 1,
              marginTop: scaleSpacing(Space[8]),
            },
          ]}
        >
          <Ionicons name="log-out-outline" size={scaleFont(20)} color={colors.error} />
          <AppText variant="body" style={{ color: colors.error, fontWeight: '600', marginLeft: 8 }}>
            Cerrar sesión
          </AppText>
        </Pressable>
      </ScrollView>

      <AppModal
        visible={showLogout}
        title="Cerrar sesión"
        message="¿Estás seguro de que deseas salir?"
        confirmText="Salir"
        onConfirm={logout}
        onCancel={() => setShowLogout(false)}
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
  content: { flexGrow: 1 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    paddingVertical: 14,
  },
});
