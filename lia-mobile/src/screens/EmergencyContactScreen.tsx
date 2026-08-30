import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types';
import { AppText, Button, Header, Input, Screen, Toast } from '../components';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { BrandColors } from '../theme/brand';
import { Radius, Space } from '../theme/tokens';
import { isValidEmergencyPhone, normalizeEmergencyPhone } from '../utils/helpers';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'EmergencyContact'>;
};

function fieldErrorFor(value: string, touched: boolean): string {
  if (!touched) return '';
  if (!value.trim()) return 'Ingresa un número de contacto.';
  if (!isValidEmergencyPhone(value)) return 'Ingresa un número de teléfono válido.';
  return '';
}

export default function EmergencyContactScreen({ navigation }: Props) {
  const { user, updateEmergencyContact } = useAuth();
  const { colors, isDark, isHighContrast } = useTheme();
  const { minTouch, scaleSpacing } = useAccessibility();
  const lightChrome = !isDark && !isHighContrast;
  const savedNumber = user?.emergencyContact ?? '';

  const [phone, setPhone] = useState(savedNumber);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'success' as 'success' | 'error' | 'info',
  });
  const goBackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPhone(savedNumber);
  }, [savedNumber]);

  useEffect(() => {
    return () => {
      if (goBackTimer.current) clearTimeout(goBackTimer.current);
    };
  }, []);

  const normalizedCurrent = useMemo(() => normalizeEmergencyPhone(phone), [phone]);
  const normalizedSaved = useMemo(() => normalizeEmergencyPhone(savedNumber), [savedNumber]);
  const hasChanges = (normalizedCurrent ?? '') !== (normalizedSaved ?? '');
  const isValid = normalizedCurrent !== null;
  const canSave = isValid && hasChanges;
  const fieldError = fieldErrorFor(phone, touched);
  const iconColor = lightChrome ? BrandColors.navy : colors.textPrimary;

  const handleSave = async () => {
    setTouched(true);
    if (saving) return;
    if (!phone.trim()) return;
    if (!normalizedCurrent || !hasChanges) return;

    setSaving(true);
    try {
      await updateEmergencyContact(normalizedCurrent);
      setToast({
        visible: true,
        message: 'Contacto de emergencia actualizado.',
        type: 'success',
      });
      goBackTimer.current = setTimeout(() => {
        navigation.goBack();
      }, 900);
    } catch {
      setToast({
        visible: true,
        message: 'No pudimos guardar el contacto. Inténtalo nuevamente.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: lightChrome ? BrandColors.white : colors.background },
      ]}
    >
      <Header
        title="Contacto de emergencia"
        showBack
        onBack={() => navigation.goBack()}
      />

      <Screen scroll keyboard transparent>
        <AppText
          variant="body"
          tone="secondary"
          style={{ marginBottom: scaleSpacing(Space[24]), lineHeight: 24 }}
        >
          Usaremos este número para que puedas comunicarte rápidamente cuando necesites ayuda.
        </AppText>

        <Input
          chrome="white"
          label="Número de contacto"
          placeholder="Ej. +57 300 123 4567"
          value={phone}
          onChangeText={(value) => {
            setPhone(value);
            if (!touched) setTouched(true);
          }}
          onBlur={() => setTouched(true)}
          error={fieldError}
          keyboardType="phone-pad"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          textContentType="none"
          returnKeyType="done"
          onSubmitEditing={() => {
            if (canSave) void handleSave();
          }}
          icon={<Ionicons name="call-outline" size={20} color={iconColor} />}
          right={
            phone ? (
              <Pressable
                onPress={() => {
                  setPhone('');
                  setTouched(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Borrar número"
                hitSlop={8}
                style={{
                  minWidth: minTouch,
                  minHeight: minTouch,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close-circle" size={22} color={iconColor} />
              </Pressable>
            ) : null
          }
          accessibilityHint="Introduce un número de teléfono, con o sin prefijo internacional"
        />

        <Button
          title="Guardar cambios"
          onPress={() => void handleSave()}
          loading={saving}
          disabled={!canSave}
          accessibilityLabel="Guardar cambios"
          accessibilityHint="Guarda el número de contacto de emergencia"
          style={{
            marginTop: scaleSpacing(Space[8]),
            borderRadius: Radius.lg,
            minHeight: Math.max(minTouch, 52),
            backgroundColor: colors.primary,
          }}
        />
      </Screen>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((current) => ({ ...current, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
