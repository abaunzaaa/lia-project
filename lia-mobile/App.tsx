import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import { AuthProvider } from './src/context/AuthContext';
import { AccessibilityProvider } from './src/context/AccessibilityContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { MedicationProvider } from './src/context/MedicationContext';
import { ReminderProvider } from './src/context/ReminderContext';
import { CameraRecognitionProvider } from './src/context/CameraRecognitionContext';

import NotificationBootstrap from './src/components/NotificationBootstrap';
import AppNavigator from './src/navigation/AppNavigator';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': require('./src/assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('./src/assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold': require('./src/assets/fonts/Inter-SemiBold.ttf'),
  });

  useEffect(() => {
    if (fontError && __DEV__) {
      console.warn(`[fonts] load failed ${fontError.name}`);
    }
  }, [fontError]);

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, fontError]);

  if (fontError) {
    return (
      <View style={styles.fontError}>
        <Text style={styles.fontErrorText}>
          No se pudieron cargar las letras. Cierra la aplicación y ábrela de nuevo.
        </Text>
      </View>
    );
  }

  if (!fontsLoaded) {
    return null;
  }

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
  root: {
    flex: 1,
  },
  fontError: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#F7F1E8',
  },
  fontErrorText: {
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
    color: '#1B3A4B',
  },
});
