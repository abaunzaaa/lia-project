import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontFamily, FontWeight, Radius, Space } from '../theme/tokens';
import { BrandColors } from '../theme/brand';
import { MainTabParamList } from '../types';
import HomeScreen from '../screens/HomeScreen';
import MedicationsScreen from '../screens/MedicationsScreen';
import RemindersScreen from '../screens/RemindersScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_META: Record<
  keyof MainTabParamList,
  { label: string; icon: keyof typeof Ionicons.glyphMap; iconFocused: keyof typeof Ionicons.glyphMap }
> = {
  Home: { label: 'Inicio', icon: 'home-outline', iconFocused: 'home' },
  Medications: { label: 'Medicamentos', icon: 'medkit-outline', iconFocused: 'medkit' },
  Reminders: { label: 'Recordatorios', icon: 'notifications-outline', iconFocused: 'notifications' },
  History: { label: 'Historial', icon: 'time-outline', iconFocused: 'time' },
  Profile: { label: 'Perfil', icon: 'person-outline', iconFocused: 'person' },
};

/**
 * Labels estructurales: una sola línea, palabras completas.
 * El modo mayor NO escala estos labels (sí el contenido de las pantallas).
 * Si el ancho es justo, se reduce un poco el tamaño — nunca se parte la palabra.
 */
function TabLabel({
  label,
  color,
  focused,
  fontSize,
  tabWidth,
  tight,
}: {
  label: string;
  color: string;
  focused: boolean;
  fontSize: number;
  tabWidth: number;
  tight: boolean;
}) {
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.78}
      allowFontScaling={false}
      maxFontSizeMultiplier={1}
      style={{
        color,
        fontFamily: FontFamily.medium,
        fontSize,
        fontWeight: focused ? FontWeight.semiBold : FontWeight.medium,
        textAlign: 'center',
        width: Math.max(tabWidth - 8, 52),
        marginTop: 3,
        letterSpacing: tight ? -0.2 : 0,
        includeFontPadding: false,
      }}
    >
      {label}
    </Text>
  );
}

export default function MainTabNavigator() {
  const insets = useSafeAreaInsets();
  const { isSeniorMode, textSize, fontScale } = useAccessibility();
  const { colors, isHighContrast, isDark } = useTheme();
  const { width } = useResponsive();

  const tight = width < 360;
  const veryTight = width < 340;
  const largeType = isSeniorMode || textSize === 'lg' || fontScale >= 1.2;

  const labelSize = veryTight ? 10 : tight ? 10.5 : 11;
  const iconSize = largeType ? 22 : tight ? 18 : 20;

  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 8 : 6);
  const topPad = largeType ? 8 : 6;
  const contentBlock = largeType ? 52 : tight ? 44 : 46;
  const tabHeight = contentBlock + topPad + bottomPad;
  const tabWidth = Math.floor(width / 5);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const meta = TAB_META[route.name];
        return {
          headerShown: false,
          tabBarActiveTintColor: isHighContrast
            ? colors.textPrimary
            : isDark
              ? colors.primary
              : BrandColors.navy,
          tabBarInactiveTintColor: isHighContrast
            ? colors.textMuted
            : isDark
              ? BrandColors.skyBlue
              : BrandColors.teal,
          tabBarAllowFontScaling: false,
          tabBarShowLabel: true,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: isHighContrast
              ? colors.surfaceElevated
              : isDark
                ? colors.surfaceElevated
                : BrandColors.white,
            borderTopColor: colors.border,
            borderTopWidth: isHighContrast ? 2 : StyleSheet.hairlineWidth,
            height: tabHeight,
            paddingBottom: bottomPad,
            paddingTop: topPad,
            paddingHorizontal: 0,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarItemStyle: {
            flex: 1,
            paddingHorizontal: 2,
            marginHorizontal: 0,
            minWidth: 0,
            maxWidth: tabWidth,
            alignItems: 'center',
            justifyContent: 'center',
          },
          tabBarIconStyle: {
            marginTop: 0,
            marginBottom: 0,
          },
          tabBarIcon: ({ focused, color }) => (
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                width: Math.min(40, Math.max(tabWidth - 8, 28)),
                height: iconSize + (focused ? 8 : 4),
                borderRadius: Radius.full,
                backgroundColor:
                  focused && !isHighContrast
                    ? isDark
                      ? 'rgba(200, 217, 230, 0.2)'
                      : 'rgba(200, 217, 230, 0.65)'
                    : 'transparent',
                paddingHorizontal: Space[8],
              }}
            >
              <Ionicons
                name={focused ? meta.iconFocused : meta.icon}
                size={iconSize}
                color={color}
              />
            </View>
          ),
          tabBarLabel: ({ focused, color }) => (
            <TabLabel
              label={meta.label}
              color={color}
              focused={focused}
              fontSize={labelSize}
              tabWidth={tabWidth}
              tight={tight || veryTight}
            />
          ),
        };
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarAccessibilityLabel: 'Inicio' }}
      />
      <Tab.Screen
        name="Medications"
        component={MedicationsScreen}
        options={{ tabBarAccessibilityLabel: 'Medicamentos' }}
      />
      <Tab.Screen
        name="Reminders"
        component={RemindersScreen}
        options={{ tabBarAccessibilityLabel: 'Recordatorios' }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarAccessibilityLabel: 'Historial' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarAccessibilityLabel: 'Perfil' }}
      />
    </Tab.Navigator>
  );
}
