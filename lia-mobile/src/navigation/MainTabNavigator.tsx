import React from 'react';
import {
  Platform,
  StyleSheet,
  View,
  Text,
} from 'react-native';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MainTabParamList } from '../types';

import HomeScreen from '../screens/HomeScreen';
import MedicationsScreen from '../screens/MedicationsScreen';
import RemindersScreen from '../screens/RemindersScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';

import { useAccessibility } from '../context/AccessibilityContext';

import { BrandColors } from '../theme/brand';
import { FontFamily, FontWeight, Radius } from '../theme/tokens';


const Tab = createBottomTabNavigator<MainTabParamList>();


const TAB_META: Record<
  keyof MainTabParamList,
  {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconFocused: keyof typeof Ionicons.glyphMap;
  }
> = {

  Home: {
    label: 'Inicio',
    icon: 'home-outline',
    iconFocused: 'home',
  },

  Medications: {
    label: 'Medicinas',
    icon: 'medkit-outline',
    iconFocused: 'medkit',
  },

  Reminders: {
    label: 'Alarmas',
    icon: 'notifications-outline',
    iconFocused: 'notifications',
  },

  History: {
    label: 'Historial',
    icon: 'time-outline',
    iconFocused: 'time',
  },

  Profile: {
    label: 'Perfil',
    icon: 'person-outline',
    iconFocused: 'person',
  },

};



export default function MainTabNavigator() {

  const insets = useSafeAreaInsets();


  const {
    isSeniorMode,
    textSize,
    fontScale,
  } = useAccessibility();



  const largeType =
    isSeniorMode ||
    textSize === 'lg' ||
    fontScale >= 1.2;



  const tabHeight =
    largeType ? 90 : 82;


  const iconSize =
    largeType ? 28 : 25;



  const bottomPadding =
    Math.max(
      insets.bottom,
      Platform.OS === 'ios' ? 8 : 6
    );



  return (

    <Tab.Navigator

      screenOptions={({ route }) => {

        const meta = TAB_META[route.name];


        return {

          headerShown:false,

          tabBarHideOnKeyboard:true,

          tabBarShowLabel:false,


          tabBarStyle: {

            backgroundColor:
              BrandColors.white,


            borderTopWidth:
              StyleSheet.hairlineWidth,


            borderTopColor:
              BrandColors.cardBorder,


            height:
              tabHeight,


            paddingBottom:
              bottomPadding,


            paddingTop:
              20,


            elevation:0,

            shadowOpacity:0,

          },


          tabBarItemStyle: {

            justifyContent:
              'center',

            alignItems:
              'center',

          },



          tabBarIcon: ({ focused, color }) => (

            <View
              style={styles.tabItem}
            >

              <View

                style={[
                  styles.iconContainer,

                  focused && styles.iconActive,
                ]}

              >

                <Ionicons

                  name={
                    focused
                      ? meta.iconFocused
                      : meta.icon
                  }

                  size={iconSize}

                  color={
                    focused
                      ? BrandColors.navy
                      : color
                  }

                />

              </View>



              <Text

                style={[
                  styles.label,

                  focused && styles.labelActive,
                ]}

              >

                {meta.label}

              </Text>


            </View>

          ),


        };

      }}

    >


      <Tab.Screen
        name="Home"
        component={HomeScreen}
      />


      <Tab.Screen
        name="Medications"
        component={MedicationsScreen}
      />


      <Tab.Screen
        name="Reminders"
        component={RemindersScreen}
      />


      <Tab.Screen
        name="History"
        component={HistoryScreen}
      />


      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
      />


    </Tab.Navigator>

  );

}



const styles = StyleSheet.create({


  tabItem: {

    alignItems:
      'center',

    justifyContent:
      'center',

    gap:
      0,

  },


  iconContainer: {

    width:
      42,

    height:
      42,

    borderRadius:
      Radius.full,

    alignItems:
      'center',

    justifyContent:
      'center',

  },


  iconActive: {

    backgroundColor:
      BrandColors.skyBlue,

  },


  label: {

    fontFamily:
      FontFamily.medium,


    fontWeight:
      FontWeight.medium,


    fontSize:
      11,


    color:
      BrandColors.teal,


  },


  labelActive: {

    color:
      BrandColors.navy,

  },


});