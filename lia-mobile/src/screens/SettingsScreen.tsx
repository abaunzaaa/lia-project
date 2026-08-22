import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Switch, Alert, Pressable } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import {
  AppText,
  Header,
  TextSizeSelector,
  ThemeSelector,
  Toast,
} from '../components';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAuth } from '../context/AuthContext';
import { useMedications } from '../context/MedicationContext';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors } from '../theme/brand';
import { Radius, Space } from '../theme/tokens';
import {
  disablePhoneReminders,
  enablePhoneReminders,
  getEffectivePhoneRemindersEnabled,
} from '../services/notificationService';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
};

export default function SettingsScreen({ navigation }: Props) {
  const {
    mode,
    isSeniorMode,
    toggleSeniorMode,
    scaleFont,
    scaleSpacing,
    minTouch,
    voiceEnabled,
    setVoiceEnabled,
  } = useAccessibility();
  const { isDemo } = useAuth();
  const { medications } = useMedications();
  const { colors, isHighContrast, isDark, appearance, setAppearance } = useTheme();
  const { horizontalPadding, contentMaxWidth } = useResponsive();

  const [notifications, setNotifications] = useState(false);
  const [permissionHint, setPermissionHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ visible: false, message: '', type: 'info' });

  const refresh = useCallback(async () => {
    const state = await getEffectivePhoneRemindersEnabled();
    setNotifications(state.effective);
    setPermissionHint(state.preference && !state.permissionGranted);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleVoiceToggle = async (value: boolean) => {
    const wasOff = !voiceEnabled;
    await setVoiceEnabled(value);
    if (value && wasOff) {
      const { speakVoiceEnabledConfirmation } = await import('../services/speechService');
      await speakVoiceEnabledConfirmation();
    }
  };

  const handleHighContrast = (enabled: boolean) => {
    if (enabled) {
      void setAppearance('highContrast');
    } else {
      void setAppearance('light');
    }
  };

  const handleNotifications = (value: boolean) => {
    if (busy) return;

    if (isDemo) {
      setToast({
        visible: true,
        message: 'En modo demo no se programan recordatorios del teléfono.',
        type: 'info',
      });
      return;
    }

    if (!value) {
      setBusy(true);
      void (async () => {
        await disablePhoneReminders();
        setNotifications(false);
        setPermissionHint(false);
        setBusy(false);
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
            setBusy(true);
            void (async () => {
              const result = await enablePhoneReminders(medications, { isDemo: false });
              await refresh();
              if (!result.ok) {
                setToast({
                  visible: true,
                  message: result.message || 'No pudimos activar los recordatorios del teléfono.',
                  type: 'error',
                });
              }
              setBusy(false);
            })();
          },
        },
      ]
    );
  };

  const surface = colors.surface;
  const settingRow = isSeniorMode
    ? { flexDirection: 'column' as const, alignItems: 'stretch' as const, gap: scaleSpacing(Space[12]) }
    : { flexDirection: 'row' as const, alignItems: 'center' as const };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Configuración" showBack onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          maxWidth: contentMaxWidth,
          alignSelf: 'center',
          width: '100%',
          paddingBottom: scaleSpacing(Space[40]),
        }}
      >
        <AppText
          variant="overline"
          style={{ marginBottom: scaleSpacing(Space[8]), marginTop: scaleSpacing(Space[8]) }}
        >
          Tema
        </AppText>
        <AppText variant="caption" tone="secondary" style={{ marginBottom: scaleSpacing(Space[12]) }}>
          Claro o Noche. Se guarda en este dispositivo.
        </AppText>
        <ThemeSelector mode="appearance" />

        <Pressable
          onPress={() => handleHighContrast(appearance !== 'highContrast')}
          accessibilityRole="switch"
          accessibilityState={{ checked: appearance === 'highContrast' }}
          accessibilityLabel="Alto contraste"
          style={[
            styles.settingItem,
            settingRow,
            {
              backgroundColor: surface,
              borderColor: colors.border,
              borderWidth: isHighContrast ? 2 : 1,
              minHeight: Math.max(minTouch + 8, 56),
              padding: scaleSpacing(Space[16]),
              marginTop: scaleSpacing(Space[16]),
              marginBottom: scaleSpacing(Space[8]),
            },
          ]}
        >
          <View style={styles.settingInfo}>
            <AppText variant="body" style={{ fontWeight: '600' }}>
              Alto contraste
            </AppText>
            <AppText variant="caption" tone="secondary" style={{ marginTop: 2 }}>
              Texto y bordes más marcados
            </AppText>
          </View>
          <Switch
            value={appearance === 'highContrast'}
            onValueChange={handleHighContrast}
            trackColor={{ false: colors.border, true: BrandColors.teal }}
            thumbColor={appearance === 'highContrast' ? BrandColors.navy : colors.surface}
            pointerEvents="none"
            focusable={false}
            accessible={false}
          />
        </Pressable>

        <AppText
          variant="overline"
          style={{ marginBottom: scaleSpacing(Space[8]), marginTop: scaleSpacing(Space[16]) }}
        >
          Accesibilidad
        </AppText>

        <Pressable
          onPress={toggleSeniorMode}
          accessibilityRole="switch"
          accessibilityState={{ checked: mode === 'senior' }}
          accessibilityLabel="Modo adulto mayor"
          style={[
            styles.settingItem,
            settingRow,
            {
              backgroundColor: surface,
              borderColor: colors.border,
              borderWidth: isHighContrast ? 2 : 1,
              minHeight: Math.max(minTouch + 8, 56),
              padding: scaleSpacing(Space[16]),
              marginBottom: scaleSpacing(Space[8]),
            },
          ]}
        >
          <View style={styles.settingInfo}>
            <AppText variant="body" style={{ fontWeight: '600' }}>
              Modo adulto mayor
            </AppText>
            <AppText variant="caption" tone="secondary" style={{ marginTop: 2 }}>
              Texto y botones más grandes
            </AppText>
          </View>
          <Switch
            value={mode === 'senior'}
            onValueChange={toggleSeniorMode}
            trackColor={{ false: colors.border, true: BrandColors.teal }}
            thumbColor={mode === 'senior' ? BrandColors.navy : colors.surface}
            pointerEvents="none"
            focusable={false}
            accessible={false}
          />
        </Pressable>

        <View
          style={[
            styles.settingItem,
            {
              backgroundColor: surface,
              borderColor: colors.border,
              borderWidth: isHighContrast ? 2 : 1,
              padding: scaleSpacing(Space[16]),
              marginBottom: scaleSpacing(Space[8]),
              flexDirection: 'column',
              alignItems: 'stretch',
            },
          ]}
        >
          <AppText variant="body" style={{ fontWeight: '600', marginBottom: scaleSpacing(Space[12]) }}>
            Tamaño del texto
          </AppText>
          <TextSizeSelector />
        </View>

        <Pressable
          onPress={() => void handleVoiceToggle(!voiceEnabled)}
          accessibilityRole="switch"
          accessibilityState={{ checked: voiceEnabled }}
          accessibilityLabel="Lectura por voz"
          style={[
            styles.settingItem,
            settingRow,
            {
              backgroundColor: surface,
              borderColor: colors.border,
              borderWidth: isHighContrast ? 2 : 1,
              minHeight: Math.max(minTouch + 8, 56),
              padding: scaleSpacing(Space[16]),
              marginBottom: scaleSpacing(Space[8]),
            },
          ]}
        >
          <View style={styles.settingInfo}>
            <AppText variant="body" style={{ fontWeight: '600' }}>
              Lectura por voz
            </AppText>
            <AppText variant="caption" tone="secondary" style={{ marginTop: 2 }}>
              LIA puede leer en voz alta información importante.
            </AppText>
          </View>
          <Switch
            value={voiceEnabled}
            onValueChange={handleVoiceToggle}
            trackColor={{ false: colors.border, true: BrandColors.teal }}
            thumbColor={voiceEnabled ? BrandColors.navy : colors.surface}
            pointerEvents="none"
            focusable={false}
            accessible={false}
          />
        </Pressable>

        <AppText
          variant="overline"
          style={{ marginBottom: scaleSpacing(Space[8]), marginTop: scaleSpacing(Space[16]) }}
        >
          Notificaciones
        </AppText>

        <Pressable
          onPress={() => handleNotifications(!notifications)}
          disabled={busy || isDemo}
          accessibilityRole="switch"
          accessibilityState={{ checked: notifications, disabled: busy || isDemo }}
          accessibilityLabel="Notificaciones de medicamentos"
          style={[
            styles.settingItem,
            settingRow,
            {
              backgroundColor: surface,
              borderColor: colors.border,
              borderWidth: isHighContrast ? 2 : 1,
              minHeight: Math.max(minTouch + 8, 56),
              padding: scaleSpacing(Space[16]),
              marginBottom: scaleSpacing(Space[8]),
            },
          ]}
        >
          <View style={styles.settingInfo}>
            <AppText variant="body" style={{ fontWeight: '600' }}>
              Notificaciones de medicamentos
            </AppText>
            <AppText variant="caption" tone="secondary" style={{ marginTop: 2 }}>
              Recordatorios del teléfono a la hora de cada toma
            </AppText>
            {permissionHint ? (
              <AppText variant="caption" tone="secondary" style={{ marginTop: 8 }}>
                Las notificaciones están desactivadas. Puedes activarlas desde la configuración de tu
                teléfono para que LIA pueda avisarte a tiempo.
              </AppText>
            ) : null}
          </View>
          <Switch
            value={notifications}
            onValueChange={handleNotifications}
            disabled={busy || isDemo}
            trackColor={{ false: colors.border, true: BrandColors.teal }}
            thumbColor={notifications ? BrandColors.navy : colors.surface}
            pointerEvents="none"
            focusable={false}
            accessible={false}
          />
        </Pressable>

        <View style={{ alignItems: 'center', marginTop: scaleSpacing(Space[32]) }}>
          <AppText variant="h3" style={{ color: isHighContrast ? colors.textPrimary : isDark ? colors.textPrimary : BrandColors.navy }}>
            LIA v1.0.0
          </AppText>
          <AppText variant="caption" tone="secondary" style={{ marginTop: 4 }}>
            Asistente Inteligente de Medicamentos
          </AppText>
        </View>
      </ScrollView>

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
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
  },
  settingInfo: { flex: 1, minWidth: 0, marginRight: Space[8] },
});
