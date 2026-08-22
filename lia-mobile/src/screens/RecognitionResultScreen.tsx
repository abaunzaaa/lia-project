import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../utils/theme';
import { RootStackParamList } from '../types';
import { Header, Button, SpeakButton } from '../components';
import { useAccessibility } from '../context/AccessibilityContext';
import { buildRecognitionResultSpeech } from '../utils/speechPhrases';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'RecognitionResult'>;
  route: RouteProp<RootStackParamList, 'RecognitionResult'>;
};

export default function RecognitionResultScreen({ navigation, route }: Props) {
  const { result } = route.params;
  const { scaleFont, scaleSpacing } = useAccessibility();

  return (
    <View style={styles.container}>
      <Header title="Resultado" showBack onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.resultCard, Shadows.lg]}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={48} color={Colors.green} />
          </View>

          <Text style={[styles.label, { fontSize: scaleFont(Typography.sizes.sm) }]}>
            Medicamento identificado
          </Text>
          <Text style={[styles.name, { fontSize: scaleFont(Typography.sizes.xxl) }]}>
            {result.name}
          </Text>

          <View style={styles.confidenceBadge}>
            <Text style={[styles.confidence, { fontSize: scaleFont(Typography.sizes.sm) }]}>
              Confianza: {result.confidence}%
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={22} color={Colors.primary} />
            <Text style={[styles.description, { fontSize: scaleFont(Typography.sizes.md) }]}>
              {result.description}
            </Text>
          </View>

          {result.dose ? (
            <View style={styles.doseRow}>
              <Ionicons name="medical-outline" size={20} color={Colors.textSecondary} />
              <Text style={[styles.dose, { fontSize: scaleFont(Typography.sizes.md) }]}>
                Dosis sugerida: {result.dose}
              </Text>
            </View>
          ) : null}

          <SpeakButton
            id="recognition-result"
            label="Escuchar resultado"
            stopLabel="Detener lectura"
            text={() =>
              buildRecognitionResultSpeech({
                name: result.name,
                description: result.description,
                dose: result.dose,
              })
            }
            style={{ marginTop: scaleSpacing(16), alignSelf: 'center' }}
          />
        </View>

        <Button
          title="Agregar medicamento"
          onPress={() =>
            navigation.navigate('AddMedication', {
              prefilled: {
                name: result.name,
                dose: result.dose,
                description: result.description,
              },
            })
          }
          icon={<Ionicons name="add-circle" size={22} color={Colors.white} />}
        />

        <Button
          title="Escanear otro"
          variant="outline"
          onPress={() => navigation.goBack()}
          style={styles.secondaryBtn}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.beige },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  resultCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  successIcon: { marginBottom: Spacing.md },
  label: {
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  name: {
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text,
    textAlign: 'center',
    marginVertical: Spacing.sm,
  },
  confidenceBadge: {
    backgroundColor: Colors.green + '25',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  confidence: { fontFamily: Typography.fontFamily.semiBold, color: Colors.greenDark },
  divider: { width: '100%', height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  infoRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', width: '100%' },
  description: {
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text,
    flex: 1,
    lineHeight: 24,
  },
  doseRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    marginTop: Spacing.md,
    width: '100%',
  },
  dose: { fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },
  secondaryBtn: { marginTop: Spacing.md },
});
