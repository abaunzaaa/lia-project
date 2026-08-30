import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';

import { AuthProvider } from './src/context/AuthContext';
import { AccessibilityProvider } from './src/context/AccessibilityContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { MedicationProvider } from './src/context/MedicationContext';
import { ReminderProvider } from './src/context/ReminderContext';
import { CameraRecognitionProvider } from './src/context/CameraRecognitionContext';

import NotificationBootstrap from './src/components/NotificationBootstrap';
import AppNavigator from './src/navigation/AppNavigator';


export default function App() {


  const [fontsLoaded] = useFonts({

    'Inter-Regular':
      require('./src/assets/fonts/Inter-Regular.ttf'),

    'Inter-Medium':
      require('./src/assets/fonts/Inter-Medium.ttf'),

    'Inter-SemiBold':
      require('./src/assets/fonts/Inter-SemiBold.ttf'),

  });


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

  root:{
    flex:1,
  },

});