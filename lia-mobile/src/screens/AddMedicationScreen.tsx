import React, { useState } from 'react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, MedicationFormData } from '../types';
import MedicationForm from '../components/MedicationForm';
import { useMedications } from '../context/MedicationContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { MedicationApiError } from '../services/medicationApi';
import { speakText } from '../services/speechService';
import { SPEECH_MED_ADDED_OK } from '../utils/speechPhrases';
import { Toast } from '../components';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AddMedication'>;
  route: RouteProp<RootStackParamList, 'AddMedication'>;
};

export default function AddMedicationScreen({ navigation, route }: Props) {
  const { addMedication } = useMedications();
  const { voiceEnabled } = useAccessibility();
  const prefilled = route.params?.prefilled;
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error';
  }>({ visible: false, message: '', type: 'success' });

  const handleSubmit = async (data: MedicationFormData) => {
    if (loading) return;
    setLoading(true);
    try {
      await addMedication(data);
      setToast({
        visible: true,
        message: 'Medicamento guardado',
        type: 'success',
      });
      if (voiceEnabled) {
        void speakText(SPEECH_MED_ADDED_OK, { id: 'med-added' });
      }
      setTimeout(() => navigation.navigate('Main', { screen: 'Medications' }), 900);
    } catch (e) {
      const message =
        e instanceof MedicationApiError
          ? e.message
          : 'No pudimos guardar el medicamento. Revisa tu conexión e inténtalo nuevamente.';
      setToast({ visible: true, message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <MedicationForm
        mode="add"
        initial={prefilled || null}
        loading={loading}
        onSubmit={handleSubmit}
        onCancel={() => navigation.goBack()}
      />
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </>
  );
}
