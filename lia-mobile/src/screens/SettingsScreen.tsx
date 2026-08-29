import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Switch, Alert, Pressable } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
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
import { Space } from '../theme/tokens';
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
  const { contentMaxWidth } = useResponsive();

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

  const lightChrome = !isDark && !isHighContrast;
  const cardBg = lightChrome ? '#FFFFFF' : colors.surface;
  const cardBorder = lightChrome ? '#F0F1F2' : colors.border;
  const iconColor = lightChrome ? BrandColors.navy : colors.textPrimary;
  const settingRow = isSeniorMode
    ? { flexDirection: 'column' as const, alignItems: 'stretch' as const, gap: scaleSpacing(Space[12]) }
    : { flexDirection: 'row' as const, alignItems: 'center' as const };
  const cardStyle = {
    backgroundColor: cardBg,
    borderColor: cardBorder,
    borderWidth: isHighContrast ? 2 : 1,
  };
  const switchTrack = {
    false: colors.border,
    true: BrandColors.teal,
  };
  const sectionTitleStyle = [
    styles.sectionTitle,
    !lightChrome && { color: colors.textSecondary },
  ];
  const iconWrapStyle = [
    styles.iconCircle,
    !lightChrome && { backgroundColor: 'transparent' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: lightChrome ? '#FFFFFF' : colors.background }]}>
      <Header title="Configuración" showBack onBack={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          maxWidth: contentMaxWidth,
          alignSelf: 'center',
          width: '100%',
          paddingBottom: 40,
        }}
      >
        <AppText variant="body" style={sectionTitleStyle}>
          Tema
        </AppText>
        <AppText variant="caption" tone="secondary" style={styles.sectionCaption}>
          Claro o Noche. Se guarda en este dispositivo.
        </AppText>

        <View style={[styles.cardList, cardStyle]}>
          <View style={styles.selectorPad}>
            <ThemeSelector mode="appearance" />
          </View>
        </View>

        <View style={[styles.cardList, cardStyle]}>
          <Pressable
            onPress={() => handleHighContrast(appearance !== 'highContrast')}
            accessibilityRole="switch"
            accessibilityState={{ checked: appearance === 'highContrast' }}
            accessibilityLabel="Alto contraste"
            style={[
              styles.row,
              settingRow,
              { minHeight: Math.max(minTouch + 8, 56) },
            ]}
          >
            <View style={iconWrapStyle}>
              <Ionicons name="contrast-outline" size={22} color={iconColor} />
            </View>
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
              trackColor={switchTrack}
              thumbColor={BrandColors.white}
              pointerEvents="none"
              focusable={false}
              accessible={false}
            />
          </Pressable>
        </View>

        <AppText variant="body" style={sectionTitleStyle}>
          Accesibilidad
        </AppText>

        <View style={[styles.cardList, cardStyle]}>
          <Pressable
            onPress={toggleSeniorMode}
            accessibilityRole="switch"
            accessibilityState={{ checked: mode === 'senior' }}
            accessibilityLabel="Modo adulto mayor"
            style={[
              styles.row,
              settingRow,
              { minHeight: Math.max(minTouch + 8, 56) },
            ]}
          >
            <View style={iconWrapStyle}>
              <Ionicons name="accessibility-outline" size={22} color={iconColor} />
            </View>
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
              trackColor={switchTrack}
              thumbColor={BrandColors.white}
              pointerEvents="none"
              focusable={false}
              accessible={false}
            />
          </Pressable>
        </View>

        <View style={[styles.cardList, cardStyle]}>
          <View style={styles.selectorPad}>
            <View style={styles.textSizeHeader}>
              <View style={iconWrapStyle}>
                <Ionicons name="text-outline" size={22} color={iconColor} />
              </View>
              <AppText variant="body" style={{ fontWeight: '600', flex: 1 }}>
                Tamaño del texto
              </AppText>
            </View>
            <TextSizeSelector />
          </View>
        </View>

        <View style={[styles.cardList, cardStyle]}>
          <Pressable
            onPress={() => void handleVoiceToggle(!voiceEnabled)}
            accessibilityRole="switch"
            accessibilityState={{ checked: voiceEnabled }}
            accessibilityLabel="Lectura por voz"
            style={[
              styles.row,
              settingRow,
              { minHeight: Math.max(minTouch + 8, 56) },
            ]}
          >
            <View style={iconWrapStyle}>
              <Ionicons name="volume-medium-outline" size={22} color={iconColor} />
            </View>
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
              trackColor={switchTrack}
              thumbColor={BrandColors.white}
              pointerEvents="none"
              focusable={false}
              accessible={false}
            />
          </Pressable>
        </View>

        <AppText variant="body" style={sectionTitleStyle}>
          Notificaciones
        </AppText>

        <View style={[styles.cardList, cardStyle]}>
          <Pressable
            onPress={() => handleNotifications(!notifications)}
            disabled={busy || isDemo}
            accessibilityRole="switch"
            accessibilityState={{ checked: notifications, disabled: busy || isDemo }}
            accessibilityLabel="Notificaciones de medicamentos"
            style={[
              styles.row,
              settingRow,
              { minHeight: Math.max(minTouch + 8, 56) },
            ]}
          >
            <View style={iconWrapStyle}>
              <Ionicons name="notifications-outline" size={22} color={iconColor} />
            </View>
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
              trackColor={switchTrack}
              thumbColor={BrandColors.white}
              pointerEvents="none"
              focusable={false}
              accessible={false}
            />
          </Pressable>
        </View>

        <View style={{ alignItems: 'center', marginTop: 32 }}>
          <AppText
            variant="h3"
            style={{ color: lightChrome ? '#6F747A' : colors.textPrimary }}
          >
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
  sectionTitle: {
    marginTop: 5,
    marginBottom: 12,
    color: '#6F747A',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
    textTransform: 'none',
  },
  sectionCaption: {
    marginTop: -6,
    marginBottom: 12,
  },
  cardList: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0F1F2',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 14,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorPad: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  textSizeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  settingInfo: { flex: 1, minWidth: 0 },
});
