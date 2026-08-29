import React, { useMemo, useRef, useState } from 'react';
import { View, Pressable, TextInput, StyleSheet, Image } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types';
import {
  AppText,
  Button,
  GoogleAuthButton,
  Header,
  Input,
  Screen,
  Toast,
  ONBOARDING_CIRCLE_BG,
} from '../components';
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

const CREATE_ACCOUNT_IMAGE = require('../assets/images/crearcuenta.png');
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const { colors, isDark, isHighContrast } = useTheme();
  const { scaleSpacing, minTouch } = useAccessibility();
  const { compact, horizontalPadding, width } = useResponsive();
  const lightChrome = !isDark && !isHighContrast;

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
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'error' as 'error' | 'info' | 'success',
  });

  const iconColor = lightChrome ? BrandColors.navy : colors.textPrimary;
  const checkOk = lightChrome ? BrandColors.teal : colors.textSecondary;
  const checkPending = lightChrome ? '#8A9AA6' : colors.textMuted;

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

  const circleSize = Math.min(compact ? 176 : 208, Math.round(width * 0.52));
  const imageSize = circleSize * 1.42;
  const overflowTop = Math.round(imageSize - circleSize);

  return (
    <View style={[styles.root, { backgroundColor: lightChrome ? '#FFFFFF' : colors.background }]}>
      <Header
        title="Crear cuenta"
        showBack
        onBack={() => navigation.goBack()}
        editorial={false}
      />

      <Screen scroll keyboard transparent padded={false} contentStyle={styles.scrollBody}>
        <View style={{ paddingHorizontal: horizontalPadding, alignItems: 'center' }}>
          <View
            style={{
              width: circleSize,
              height: circleSize + overflowTop,
              marginTop: -scaleSpacing(Space[32]),
              marginBottom: scaleSpacing(Space[20]),
              overflow: 'visible',
            }}
          >
            <View
              style={[
                styles.heroCircle,
                {
                  width: circleSize,
                  height: circleSize,
                  borderRadius: circleSize / 2,
                  top: overflowTop,
                  backgroundColor: isHighContrast ? colors.surface : ONBOARDING_CIRCLE_BG,
                },
              ]}
            />
            <Image
              source={CREATE_ACCOUNT_IMAGE}
              style={{
                position: 'absolute',
                width: imageSize,
                height: imageSize,
                left: (circleSize - imageSize) / 2,
                top: 10,
                zIndex: 2,
              }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </View>

          <AppText
            variant="h2"
            accessibilityRole="header"
            style={{
              color: lightChrome ? BrandColors.navy : colors.textPrimary,
              fontWeight: '600',
              textAlign: 'center',
              marginBottom: scaleSpacing(compact ? Space[24] : Space[32]),
            }}
          >
            ¡Qué bueno tenerte aquí!
          </AppText>

          <View style={styles.form}>
          <Input
            chrome="white"
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
            chrome="white"
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
            chrome="white"
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
            chrome="white"
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
                    fontWeight: item.ok ? '600' : '400',
                  }}
                >
                  {item.ok ? '✓' : '○'} {item.label}
                </AppText>
              </View>
            ))}
          </View>

          <Input
            ref={emergencyRef}
            chrome="white"
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
            style={{
              marginTop: scaleSpacing(Space[16]),
              borderRadius: Radius.lg,
              minHeight: Math.max(minTouch, 56),
              backgroundColor: lightChrome ? BrandColors.navy : colors.primary,
            }}
          />

          <GoogleAuthButton
            title="Registrarse con Google"
            onPress={() =>
              setToast({
                visible: true,
                message: 'Próximamente disponible',
                type: 'info',
              })
            }
            accessibilityLabel="Registrarse con Google"
            accessibilityHint="Próximamente disponible. Aún no está activo."
            style={{ marginTop: scaleSpacing(Space[12]) }}
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
                marginTop: scaleSpacing(Space[4]),
                paddingTop: scaleSpacing(Space[4]),
              },
            ]}
          >
            <AppText variant="body" tone="secondary" style={{ textAlign: 'center' }}>
              ¿Ya tienes cuenta?{' '}
              <AppText
                variant="body"
                style={{
                  color: lightChrome ? BrandColors.navy : colors.textPrimary,
                  fontFamily: FontFamily.semiBold,
                  fontWeight: FontWeight.semiBold,
                }}
              >
                Inicia sesión
              </AppText>
            </AppText>
          </Pressable>
          </View>
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
    paddingBottom: 40,
  },
  heroCircle: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  form: {
    width: '100%',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginLink: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderRadius: Radius.md,
  },
});
