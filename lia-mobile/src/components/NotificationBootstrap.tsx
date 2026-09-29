import React from 'react';
import { Platform } from 'react-native';
import { useNotificationLifecycle } from '../hooks/useNotificationLifecycle';

function NativeNotificationBootstrap() {
  useNotificationLifecycle();
  return null;
}

/** Monta listeners/sync de notificaciones dentro de los providers. */
export default function NotificationBootstrap() {
  if (Platform.OS === 'web') return null;
  return <NativeNotificationBootstrap />;
}
