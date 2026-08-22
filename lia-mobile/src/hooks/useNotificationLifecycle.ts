import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../context/AuthContext';
import { useMedications } from '../context/MedicationContext';
import {
  configureNotificationHandler,
  ensureAndroidNotificationChannel,
  isMedicationReminderResponse,
  shouldSyncOnForeground,
  syncMedicationNotifications,
} from '../services/notificationService';
import { navigateToReminders } from '../navigation/navigationRef';

/**
 * Ciclo de vida de notificaciones locales:
 * - handler único
 * - tap → Recordatorios
 * - resync al volver al foreground (debounce)
 * - sync cuando cambian medicamentos / sesión
 *
 * NO pide permiso al arrancar.
 */
export function useNotificationLifecycle(): void {
  const { user, isDemo } = useAuth();
  const { medications, loading: medsLoading } = useMedications();
  const medsRef = useRef(medications);
  medsRef.current = medications;

  useEffect(() => {
    configureNotificationHandler();
    void ensureAndroidNotificationChannel();
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      if (isMedicationReminderResponse(response)) {
        navigateToReminders();
      }
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response && isMedicationReminderResponse(response)) {
        setTimeout(() => navigateToReminders(), 400);
      }
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state !== 'active') return;
      if (!user || isDemo) return;
      if (!shouldSyncOnForeground()) return;
      void syncMedicationNotifications(medsRef.current, { isDemo: false });
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [user?.uid, isDemo]);

  useEffect(() => {
    if (!user || medsLoading) return;
    if (isDemo) {
      void syncMedicationNotifications([], { isDemo: true });
      return;
    }
    void syncMedicationNotifications(medications, { isDemo: false });
  }, [user?.uid, isDemo, medications, medsLoading]);
}
