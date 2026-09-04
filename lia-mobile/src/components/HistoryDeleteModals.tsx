import React from 'react';
import { HistoryEntry } from '../types';
import AppModal from './AppModal';
import Toast from './Toast';

type ToastState = {
  visible: boolean;
  message: string;
  type: 'success' | 'error';
};

type Props = {
  confirmEntry: HistoryEntry | null;
  toast: ToastState;
  onConfirm: () => void;
  onCancel: () => void;
  onHideToast: () => void;
};

export default function HistoryDeleteModals({
  confirmEntry,
  toast,
  onConfirm,
  onCancel,
  onHideToast,
}: Props) {
  return (
    <>
      <AppModal
        visible={!!confirmEntry}
        title="¿Eliminar este registro?"
        message="Esta toma se quitará del historial. Tu medicamento y sus recordatorios continuarán activos."
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={onConfirm}
        onCancel={onCancel}
        destructive
      />
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={onHideToast}
      />
    </>
  );
}
