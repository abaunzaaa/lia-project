import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HistoryStackParamList } from '../types';
import HistoryScreen from '../screens/HistoryScreen';
import HistoryCalendarScreen from '../screens/HistoryCalendarScreen';
import HistoryAnalysisScreen from '../screens/HistoryAnalysisScreen';

const Stack = createNativeStackNavigator<HistoryStackParamList>();

export default function HistoryStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="HistoryHome" component={HistoryScreen} />
      <Stack.Screen name="HistoryCalendar" component={HistoryCalendarScreen} />
      <Stack.Screen name="HistoryAnalysis" component={HistoryAnalysisScreen} />
    </Stack.Navigator>
  );
}
