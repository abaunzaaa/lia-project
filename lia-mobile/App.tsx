import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { AccessibilityProvider } from './src/context/AccessibilityContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { MedicationProvider } from './src/context/MedicationContext';
import { ReminderProvider } from './src/context/ReminderContext';
import { CameraRecognitionProvider } from './src/context/CameraRecognitionContext';
import NotificationBootstrap from './src/components/NotificationBootstrap';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AccessibilityProvider>
          <ThemeProvider>
            <AuthProvider>
              <MedicationProvider>
                <ReminderProvider>
                  <CameraRecognitionProvider>
                    <NotificationBootstrap />
                    <AppNavigator />
                  </CameraRecognitionProvider>
                </ReminderProvider>
              </MedicationProvider>
            </AuthProvider>
          </ThemeProvider>
        </AccessibilityProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
