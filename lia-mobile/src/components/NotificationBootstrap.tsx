import React from 'react';
import { useNotificationLifecycle } from '../hooks/useNotificationLifecycle';

/** Monta listeners/sync de notificaciones dentro de los providers. */
export default function NotificationBootstrap() {
  useNotificationLifecycle();
  return null;
}
