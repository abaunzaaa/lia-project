import React, { useRef, useState } from 'react';
import { View, Pressable, TextInput, StyleSheet, Platform, Text } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types';
import {
  AppText,
  Button,
  EditorialText,
  Input,
  Screen,
  Toast,
  WelcomeBrandLogo,
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SANS = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: undefined,
});

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
  const { isDark, isHighContrast } = useTheme();
  const { scaleSpacing, minTouch, scaleFont } = useAccessibility();
  const { compact, horizontalPadding, isTablet } = useResponsive();
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

  const bg = isHighContrast ? '#000000' : isDark ? '#10161C' : BrandColors.beige;
  const subtitleColor = isHighContrast ? '#E8E8E8' : isDark ? BrandColors.skyBlue : BrandColors.teal;
  const backColor = isHighContrast ? BrandColors.white : isDark ? BrandColors.beige : BrandColors.navy;
  const linkColor = isHighContrast ? BrandColors.white : BrandColors.navy;
  const googleSurface = isHighContrast ? '#000000' : isDark ? '#182028' : BrandColors.white;
  const googleBorder = isHighContrast ? BrandColors.white : isDark ? BrandColors.teal : BrandColors.skyBlue;
  const googleText = isHighContrast ? BrandColors.white : BrandColors.navy;

  /** Logo más protagonista — responsive sin desbordar */
  const logoSize = isTablet ? 136 : compact ? 112 : 128;

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
      // AuthContext guarda JWT + usuario → AppNavigator entra a Main
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
    <View style={[styles.root, { backgroundColor: bg }]}>
      {/* Único acento de marca — arco sky blue deliberado */}
      {!isHighContrast && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View
            style={[
              styles.brandArc,
              {
                borderColor: BrandColors.skyBlue,
                opacity: isDark ? 0.22 : 0.55,
                top: compact ? -40 : -28,
              },
            ]}
          />
        </View>
      )}

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
                marginBottom: scaleSpacing(compact ? Space[12] : Space[20]),
              },
            ]}
          >
            <Ionicons name="chevron-back" size={26} color={backColor} />
          </Pressable>

          {/* Marca: logo oficial + tagline (sin repetir “LIA”) */}
          <View
            style={[
              styles.brandBlock,
              { marginBottom: scaleSpacing(compact ? Space[24] : Space[32]) },
            ]}
          >
            <WelcomeBrandLogo pageBackground={bg} size={logoSize} elevated />
            <Text
              maxFontSizeMultiplier={1.3}
              style={[
                styles.tagline,
                {
                  color: subtitleColor,
                  fontSize: scaleFont(13),
                  lineHeight: scaleFont(18),
                  marginTop: scaleSpacing(Space[16]),
                },
              ]}
            >
              Asistente Inteligente de Medicamentos
            </Text>
          </View>

          <EditorialText
            variant="subhead"
            accessibilityRole="header"
            style={{
              fontSize: scaleFont(compact ? 26 : 28),
              lineHeight: scaleFont(compact ? 32 : 34),
              marginBottom: scaleSpacing(Space[8]),
            }}
          >
            Qué bueno verte de nuevo
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
            Tus medicamentos y recordatorios te están esperando.
          </Text>

          <Input
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
            accessibilityHint="Introduce el correo con el que te registraste"
          />

          <Input
            ref={passwordRef}
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
                marginBottom: scaleSpacing(Space[16]),
              },
            ]}
          >
            <AppText
              variant="body"
              style={{
                color: linkColor,
                fontFamily: FontFamily.medium,
                fontWeight: FontWeight.medium,
                opacity: 0.85,
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
          />

          <Pressable
            onPress={() =>
              setToast({
                visible: true,
                message: 'Próximamente disponible',
                type: 'info',
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Iniciar sesión con Google"
            accessibilityHint="Próximamente disponible. Aún no está activo."
            accessibilityState={{ disabled: false }}
            style={({ pressed }) => [
              styles.googleBtn,
              {
                minHeight: Math.max(minTouch, 52),
                marginTop: scaleSpacing(Space[12]),
                backgroundColor: googleSurface,
                borderColor: googleBorder,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.googleMark,
                {
                  backgroundColor: isHighContrast ? BrandColors.white : BrandColors.beige,
                  borderColor: googleBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.googleG,
                  {
                    color: googleText,
                    fontSize: scaleFont(15),
                  },
                ]}
              >
                G
              </Text>
            </View>
            <Text
              maxFontSizeMultiplier={1.3}
              style={[
                styles.googleLabel,
                {
                  color: googleText,
                  fontSize: scaleFont(16),
                },
              ]}
            >
              Iniciar sesión con Google
            </Text>
          </Pressable>

          <View style={{ flexGrow: 1, minHeight: scaleSpacing(Space[20]) }} />

          <View
            style={[
              styles.footer,
              {
                marginTop: scaleSpacing(Space[16]),
                marginBottom: scaleSpacing(Space[8]),
              },
            ]}
          >
            <AppText variant="body" tone="secondary" style={{ textAlign: 'center' }}>
              ¿Aún no tienes cuenta?{' '}
            </AppText>
            <Pressable
              onPress={() => navigation.navigate('Register')}
              accessibilityRole="button"
              accessibilityLabel="Crear cuenta"
              accessibilityHint="Abre el registro de LIA"
              style={[styles.footerAction, { minHeight: minTouch }]}
            >
              <AppText
                variant="body"
                style={{
                  color: linkColor,
                  fontFamily: FontFamily.semiBold,
                  fontWeight: FontWeight.semiBold,
                  textAlign: 'center',
                }}
              >
                Crear cuenta
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
  },
  back: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    marginLeft: -8,
  },
  brandBlock: {
    alignItems: 'center',
    width: '100%',
  },
  tagline: {
    fontFamily: SANS,
    fontWeight: FontWeight.regular,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontFamily: SANS,
    fontWeight: FontWeight.regular,
  },
  forgot: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  footerAction: {
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  googleBtn: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  googleMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleG: {
    fontFamily: SANS,
    fontWeight: FontWeight.semiBold,
    includeFontPadding: false,
  },
  googleLabel: {
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
    letterSpacing: 0.1,
  },
  brandArc: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1.5,
    right: -90,
    backgroundColor: 'transparent',
  },
});
