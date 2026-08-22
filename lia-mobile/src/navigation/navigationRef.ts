import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';
import { RootStackParamList } from '../types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Abre la pestaña Recordatorios si la navegación está lista. */
export function navigateToReminders(): void {
  if (!navigationRef.isReady()) return;

  navigationRef.dispatch(
    CommonActions.navigate({
      name: 'Main',
      params: { screen: 'Reminders' },
    })
  );
}
