import React, { useState } from 'react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, MedicationFormData } from '../types';
import MedicationForm from '../components/MedicationForm';
import { Toast } from '../components';
import { useMedications } from '../context/MedicationContext';
import { MedicationApiError } from '../services/medicationApi';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'EditMedication'>;
  route: RouteProp<RootStackParamList, 'EditMedication'>;
};

export default function EditMedicationScreen({ navigation, route }: Props) {
  const { medication } = route.params;
  const { updateMedication } = useMedications();
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
      await updateMedication(medication.id, data);
      setToast({
        visible: true,
        message: 'Medicamento guardado correctamente.',
        type: 'success',
      });
      setTimeout(() => navigation.goBack(), 900);
    } catch (e) {
      const message =
        e instanceof MedicationApiError
          ? e.message
          : 'No pudimos guardar el medicamento. Inténtalo nuevamente.';
      setToast({ visible: true, message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <MedicationForm
        mode="edit"
        initial={medication}
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
