import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../utils/theme';
import { RootStackParamList } from '../types';
import { Button, Input, Toast } from '../components';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;
};

export default function ForgotPasswordScreen({ navigation }: Props) {
  const { forgotPassword } = useAuth();
  const { scaleFont } = useAccessibility();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' as 'error' | 'info' | 'success' });

  const handleReset = async () => {
    if (!email) {
      setToast({ visible: true, message: 'Ingresa tu correo', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(email);
      setToast({ visible: true, message: 'Te enviamos un enlace de recuperación', type: 'success' });
    } catch {
      setToast({ visible: true, message: 'No encontramos ese correo', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
        <Ionicons name="arrow-back" size={24} color={Colors.text} />
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.emoji}>🔑</Text>
        <Text style={[styles.title, { fontSize: scaleFont(Typography.sizes.xxl) }]}>Recuperar contraseña</Text>
        <Text style={[styles.subtitle, { fontSize: scaleFont(Typography.sizes.md) }]}>
          Te enviaremos un enlace a tu correo para restablecer tu contraseña
        </Text>

        <Input chrome="white" label="Correo electrónico" placeholder="tu@correo.com" value={email} onChangeText={setEmail}
          keyboardType="email-address" autoCapitalize="none"
          icon={<Ionicons name="mail-outline" size={20} color={Colors.textLight} />} />

        <Button title="Enviar enlace" onPress={handleReset} loading={loading} />
      </View>

      <Toast visible={toast.visible} message={toast.message} type={toast.type}
        onHide={() => setToast((t) => ({ ...t, visible: false }))} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', padding: Spacing.lg, paddingTop: Spacing.xxl },
  back: { marginBottom: Spacing.lg },
  content: { flex: 1 },
  emoji: { fontSize: 48, marginBottom: Spacing.lg },
  title: { fontFamily: Typography.fontFamily.bold, color: Colors.text, marginBottom: Spacing.sm },
  subtitle: { fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary, marginBottom: Spacing.xl, lineHeight: 24 },
});
