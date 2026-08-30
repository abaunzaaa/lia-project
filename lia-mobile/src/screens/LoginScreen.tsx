import React, { useRef, useState } from 'react';
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

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

const LOGIN_IMAGE = require('../assets/images/iniciosesion.png');
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    error.name === 'TypeError' ||
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network error') ||
    msg.includes('timed out')
  );
}

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const { colors, isDark, isHighContrast } = useTheme();
  const { scaleSpacing, minTouch } = useAccessibility();
  const { compact, horizontalPadding, width } = useResponsive();
  const lightChrome = !isDark && !isHighContrast;
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'error' as 'error' | 'info' | 'success',
  });

  const iconColor = lightChrome ? BrandColors.navy : colors.textPrimary;

  const circleSize = Math.min(compact ? 176 : 208, Math.round(width * 0.52));
  const imageSize = circleSize * 1.42;
  const overflowTop = Math.round(imageSize - circleSize);

  const validate = () => {
    let ok = true;
    const trimmed = email.trim();

    if (!trimmed) {
      setEmailError('Ingresa tu correo electrónico.');
      ok = false;
    } else if (!EMAIL_PATTERN.test(trimmed)) {
      setEmailError('Ingresa un correo electrónico válido.');
      ok = false;
    } else {
      setEmailError('');
    }

    if (!password) {
      setPasswordError('Ingresa tu contraseña.');
      ok = false;
    } else {
      setPasswordError('');
    }

    return ok;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (error) {
      let message = 'No pudimos iniciar sesión. Revisa el correo y la contraseña.';

      if (isNetworkError(error)) {
        message = 'No pudimos conectarnos con LIA. Revisa tu conexión e inténtalo nuevamente.';
      } else if (error instanceof AuthApiError) {
        if (error.status === 401) {
          message = 'Correo o contraseña incorrectos.';
        } else {
          message = error.message;
        }
      }

      setToast({ visible: true, message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: lightChrome ? '#FFFFFF' : colors.background }]}>
      <Header
        title="Iniciar sesión"
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
              source={LOGIN_IMAGE}
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
            ¡Qué bueno verte de nuevo!
          </AppText>

          <View style={styles.form}>
            <Input
              chrome="white"
              label="Correo electrónico"
              placeholder="Ej. maria@correo.com"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (emailError) setEmailError('');
              }}
              error={emailError}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
              icon={<Ionicons name="mail-outline" size={20} color={iconColor} />}
              accessibilityHint="Introduce el correo con el que te registraste"
            />

            <Input
              ref={passwordRef}
              chrome="white"
              label="Contraseña"
              placeholder="Tu contraseña"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (passwordError) setPasswordError('');
              }}
              error={passwordError}
              secureToggle
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleLogin}
              icon={<Ionicons name="lock-closed-outline" size={20} color={iconColor} />}
              accessibilityHint="Introduce tu contraseña. Puedes mostrarla u ocultarla."
            />

            <Pressable
              onPress={() => navigation.navigate('ForgotPassword')}
              accessibilityRole="button"
              accessibilityLabel="¿Olvidaste tu contraseña?"
              accessibilityHint="Abre la recuperación de contraseña"
              style={[
                styles.forgot,
                {
                  minHeight: minTouch,
                  marginTop: -scaleSpacing(Space[8]),
                  paddingTop: scaleSpacing(Space[4]),
                },
              ]}
            >
              <AppText
                variant="body"
                style={{
                  color: lightChrome ? BrandColors.navy : colors.textPrimary,
                  fontFamily: FontFamily.medium,
                  fontWeight: FontWeight.medium,
                }}
              >
                ¿Olvidaste tu contraseña?
              </AppText>
            </Pressable>

            <Button
              title={loading ? 'Ingresando...' : 'Iniciar sesión'}
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              accessibilityLabel="Iniciar sesión"
              accessibilityHint="Entra a LIA con tu correo y contraseña"
              style={{
                marginTop: scaleSpacing(Space[16]),
                borderRadius: Radius.lg,
                minHeight: Math.max(minTouch, 56),
                backgroundColor: lightChrome ? BrandColors.navy : colors.primary,
              }}
            />

            <GoogleAuthButton
              title="Iniciar sesión con Google"
              onPress={() =>
                setToast({
                  visible: true,
                  message: 'Próximamente disponible',
                  type: 'info',
                })
              }
              accessibilityLabel="Iniciar sesión con Google"
              accessibilityHint="Próximamente disponible. Aún no está activo."
              style={{ marginTop: scaleSpacing(Space[12]) }}
            />

            <Pressable
              onPress={() => navigation.navigate('Register')}
              accessibilityRole="button"
              accessibilityLabel="Crear cuenta"
              accessibilityHint="Abre el registro de LIA"
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
                ¿No tienes cuenta?{' '}
                <AppText
                  variant="body"
                  style={{
                    color: lightChrome ? BrandColors.navy : colors.textPrimary,
                    fontFamily: FontFamily.semiBold,
                    fontWeight: FontWeight.semiBold,
                  }}
                >
                  Crear cuenta
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
  forgot: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
  },
  loginLink: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderRadius: Radius.md,
  },
});
