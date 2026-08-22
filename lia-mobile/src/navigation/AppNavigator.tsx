import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Loading } from '../components';
import { navigationRef } from './navigationRef';
import MainTabNavigator from './MainTabNavigator';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ScanMedicationScreen from '../screens/ScanMedicationScreen';
import CameraGuideScreen from '../screens/CameraGuideScreen';
import DrugSearchScreen from '../screens/DrugSearchScreen';
import DrugInfoScreen from '../screens/DrugInfoScreen';
import RecognitionResultScreen from '../screens/RecognitionResultScreen';
import AddMedicationScreen from '../screens/AddMedicationScreen';
import EditMedicationScreen from '../screens/EditMedicationScreen';
import MedicationDetailScreen from '../screens/MedicationDetailScreen';
import DrugChatScreen from '../screens/DrugChatScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { user, loading } = useAuth();
  const { colors, isDark } = useTheme();

  if (loading) {
    return <Loading fullScreen message="Iniciando LIA..." />;
  }

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        {!user ? (
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen name="ScanMedication" component={ScanMedicationScreen} />
            <Stack.Screen name="CameraGuide" component={CameraGuideScreen} />
            <Stack.Screen name="DrugSearch" component={DrugSearchScreen} />
            <Stack.Screen name="DrugInfo" component={DrugInfoScreen} />
            <Stack.Screen name="RecognitionResult" component={RecognitionResultScreen} />
            <Stack.Screen name="AddMedication" component={AddMedicationScreen} />
            <Stack.Screen name="EditMedication" component={EditMedicationScreen} />
            <Stack.Screen name="MedicationDetail" component={MedicationDetailScreen} />
            <Stack.Screen name="DrugChat" component={DrugChatScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
