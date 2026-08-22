import React, { useMemo, useRef, useState } from 'react';
import { View, Pressable, TextInput, StyleSheet, Platform, Text } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types';
import { AppText, Button, EditorialText, Input, Screen, Toast } from '../components';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { useResponsive } from '../hooks/useResponsive';
import { BrandColors } from '../theme/brand';
import { AuthApiError } from '../services/authApi';
import { FontFamily, FontWeight, Radius, Space } from '../theme/tokens';
import {
  isValidColombianPhone,
  normalizeColombianPhone,
  passwordRequirements,
} from '../utils/helpers';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Register'>;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SANS = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: undefined,
});

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const { isDark, isHighContrast } = useTheme();
  const { scaleSpacing, minTouch, scaleFont } = useAccessibility();
  const { compact, horizontalPadding } = useResponsive();

  const ageRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const emergencyRef = useRef<TextInput>(null);

  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'error' as const });

  const bg = isHighContrast ? '#000000' : isDark ? '#10161C' : BrandColors.beige;
  const subtitleColor = isHighContrast ? '#E8E8E8' : isDark ? BrandColors.skyBlue : BrandColors.teal;
  const iconColor = isHighContrast ? BrandColors.white : isDark ? BrandColors.skyBlue : BrandColors.teal;
  const backColor = isHighContrast ? BrandColors.white : isDark ? BrandColors.beige : BrandColors.navy;
  const checkOk = isHighContrast ? BrandColors.white : isDark ? BrandColors.skyBlue : BrandColors.teal;
  const checkPending = isHighContrast ? '#888888' : BrandColors.skyBlue;

  const pwd = useMemo(() => passwordRequirements(password), [password]);

  const clearFieldError = (key: string) => {
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!fullName.trim() || fullName.trim().length < 2) {
      next.fullName = 'Escribe tu nombre completo.';
    }
    const ageNum = parseInt(age, 10);
    if (!age.trim() || Number.isNaN(ageNum)) {
      next.age = 'Escribe tu edad.';
    } else if (ageNum < 18 || ageNum > 120) {
      next.age = 'La edad debe estar entre 18 y 120 años.';
    }
    if (!email.trim()) {
      next.email = 'Escribe tu correo electrónico.';
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      next.email = 'Ingresa un correo electrónico válido.';
    }
    if (!password) {
      next.password = 'Escribe una contraseña.';
    } else if (!pwd.ok) {
      next.password =
        'La contraseña debe tener al menos 8 caracteres, una mayúscula y un carácter especial.';
    }
    if (!emergencyContact.trim() || !isValidColombianPhone(emergencyContact)) {
      next.emergencyContact = 'Ingresa un número de teléfono completo.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const phone = normalizeColombianPhone(emergencyContact);
      if (!phone) {
        setErrors((prev) => ({
          ...prev,
          emergencyContact: 'Ingresa un número de teléfono completo.',
        }));
        return;
      }
      await register({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        age: parseInt(age, 10),
        emergencyContact: phone,
      });
    } catch (error) {
      const message =
        error instanceof AuthApiError
          ? error.message
          : 'No pudimos crear la cuenta en este momento. Inténtalo nuevamente.';
      setToast({ visible: true, message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const checklist = [
    { key: 'len', ok: pwd.minLength, label: '8 caracteres' },
    { key: 'up', ok: pwd.uppercase, label: 'una mayúscula' },
    { key: 'sp', ok: pwd.special, label: 'un carácter especial' },
  ] as const;

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <Screen scroll keyboard safeTop transparent padded={false} contentStyle={styles.scrollBody}>
        <View style={{ paddingHorizontal: horizontalPadding }}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            accessibilityHint="Regresa a la pantalla anterior"
            style={[
              styles.back,
              {
                minHeight: minTouch,
                minWidth: minTouch,
                marginBottom: scaleSpacing(compact ? Space[16] : Space[24]),
              },
            ]}
          >
            <Ionicons name="chevron-back" size={26} color={backColor} />
          </Pressable>

          <EditorialText
            variant="subhead"
            accessibilityRole="header"
            style={{ marginBottom: scaleSpacing(Space[8]) }}
          >
            Crear cuenta
          </EditorialText>

          <Text
            maxFontSizeMultiplier={1.35}
            style={[
              styles.subtitle,
              {
                color: subtitleColor,
                fontSize: scaleFont(compact ? 15 : 16),
                lineHeight: scaleFont(compact ? 22 : 24),
                marginBottom: scaleSpacing(compact ? Space[24] : Space[32]),
                maxWidth: 340,
              },
            ]}
          >
            Déjame conocerte un poquito para acompañarte mejor.
          </Text>

          <Input
            label="Nombre completo"
            placeholder="Ej. María García"
            value={fullName}
            onChangeText={(v) => {
              setFullName(v);
              clearFieldError('fullName');
            }}
            error={errors.fullName}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => ageRef.current?.focus()}
            icon={<Ionicons name="person-outline" size={20} color={iconColor} />}
            accessibilityHint="Escribe tu nombre y apellido"
          />

          <Input
            ref={ageRef}
            label="Edad"
            placeholder="Ej. 68"
            value={age}
            onChangeText={(v) => {
              setAge(v.replace(/[^0-9]/g, ''));
              clearFieldError('age');
            }}
            error={errors.age}
            keyboardType="number-pad"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => emailRef.current?.focus()}
            icon={<Ionicons name="calendar-outline" size={20} color={iconColor} />}
            accessibilityHint="Escribe tu edad en años"
          />

          <Input
            ref={emailRef}
            label="Correo electrónico"
            placeholder="Ej. maria@correo.com"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              clearFieldError('email');
            }}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordRef.current?.focus()}
            icon={<Ionicons name="mail-outline" size={20} color={iconColor} />}
            accessibilityHint="Correo que usarás para entrar a LIA"
          />

          <Input
            ref={passwordRef}
            label="Contraseña"
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              clearFieldError('password');
            }}
            error={errors.password}
            secureToggle
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password-new"
            textContentType="newPassword"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => emergencyRef.current?.focus()}
            icon={<Ionicons name="lock-closed-outline" size={20} color={iconColor} />}
            accessibilityHint="Crea una contraseña con 8 caracteres, una mayúscula y un carácter especial"
          />

          <View
            style={{
              marginTop: -scaleSpacing(Space[8]),
              marginBottom: scaleSpacing(Space[16]),
              gap: scaleSpacing(Space[4]),
            }}
            accessibilityLabel="Requisitos de contraseña"
          >
            {checklist.map((item) => (
              <View key={item.key} style={styles.checkRow}>
                <AppText
                  variant="caption"
                  style={{
                    color: item.ok ? checkOk : checkPending,
                    fontWeight: item.ok ? '700' : '400',
                  }}
                >
                  {item.ok ? '✓' : '○'} {item.label}
                </AppText>
              </View>
            ))}
          </View>

          <Input
            ref={emergencyRef}
            label="Contacto de emergencia"
            placeholder="Ej. 3001234567"
            value={emergencyContact}
            onChangeText={(v) => {
              setEmergencyContact(v);
              clearFieldError('emergencyContact');
            }}
            error={errors.emergencyContact}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            returnKeyType="go"
            onSubmitEditing={handleRegister}
            icon={<Ionicons name="call-outline" size={20} color={iconColor} />}
            accessibilityHint="Número de teléfono colombiano de 10 dígitos"
          />

          <Button
            title="Crear mi cuenta"
            onPress={handleRegister}
            loading={loading}
            disabled={loading}
            accessibilityLabel="Crear mi cuenta"
            accessibilityHint="Registra tu cuenta en LIA e inicia sesión automáticamente"
            style={{ marginTop: scaleSpacing(Space[8]) }}
          />

          <Pressable
            onPress={() => navigation.navigate('Login')}
            accessibilityRole="button"
            accessibilityLabel="Ya tengo cuenta, iniciar sesión"
            accessibilityHint="Abre la pantalla de inicio de sesión"
            style={[
              styles.loginLink,
              {
                minHeight: minTouch,
                marginTop: scaleSpacing(Space[20]),
              },
            ]}
          >
            <AppText variant="body" tone="secondary" style={{ textAlign: 'center' }}>
              ¿Ya tienes cuenta?{' '}
              <AppText
                variant="body"
                style={{
                  color: isHighContrast ? BrandColors.white : isDark ? BrandColors.beige : BrandColors.navy,
                  fontFamily: FontFamily.semiBold,
                  fontWeight: FontWeight.semiBold,
                }}
              >
                Inicia sesión
              </AppText>
            </AppText>
          </Pressable>
        </View>
      </Screen>

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
  root: {
    flex: 1,
  },
  scrollBody: {
    paddingHorizontal: 0,
  },
  back: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    marginLeft: -8,
  },
  subtitle: {
    fontFamily: SANS,
    fontWeight: FontWeight.regular,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginLink: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
});
