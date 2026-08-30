import React, { useMemo } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  Text,
  Platform,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../types';
import { WelcomeHero } from '../components';

import { useAccessibility } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';

import { BrandColors } from '../theme/brand';
import { Radius, Space } from '../theme/tokens';


type Props = {
  navigation: NativeStackNavigationProp<
    RootStackParamList,
    'Onboarding'
  >;
};


const INTER = Platform.select({
  ios: 'Inter',
  android: 'Inter',
  default: 'Inter',
});


const INTER_SEMIBOLD = Platform.select({
  ios: 'Inter-SemiBold',
  android: 'Inter-SemiBold',
  default: 'Inter-SemiBold',
});


const INTER_MEDIUM = Platform.select({
  ios: 'Inter-Medium',
  android: 'Inter-Medium',
  default: 'Inter-Medium',
});



export default function OnboardingScreen({
  navigation,
}: Props) {


  const insets = useSafeAreaInsets();


  const {
    isDark,
    isHighContrast,
  } = useTheme();



  const {
    scaleSpacing,
    minTouch,
    scaleFont,
    buttonScale,
    isSeniorMode,
  } = useAccessibility();



  const {
    height,
    horizontalPadding,
    compact,
    isTablet,
    isShortScreen,
  } = useResponsive();




  const bg =
    isHighContrast
      ? '#000000'
      : isDark
        ? '#10161C'
        : '#FFFFFF';




  const titleColor =
    isDark
      ? BrandColors.white
      : BrandColors.navy;



  const bodyColor =
    isDark
      ? BrandColors.skyBlue
      : BrandColors.teal;





  const heroHeight = useMemo(() => {

    const ratio =
      isShortScreen || compact
        ? 0.56
        : isTablet
          ? 0.60
          : 0.62;


    const raw =
      Math.round(height * ratio);



    return Math.min(
      Math.max(raw, 360),
      500
    );


  }, [
    height,
    compact,
    isTablet,
    isShortScreen
  ]);





  const primaryHeight =
    Math.max(
      minTouch,
      Math.round(56 * buttonScale)
    );



  const secondaryHeight =
    Math.max(
      minTouch,
      Math.round(46 * buttonScale)
    );





  const needsScroll =
    isSeniorMode ||
    isShortScreen ||
    height < 680;





  const content = (

    <View

      style={[
        styles.column,
        {
          paddingBottom:
            Math.max(
              insets.bottom,
              scaleSpacing(Space[20])
            ),
        },
      ]}

    >


      <WelcomeHero
        height={heroHeight}
      />




      <View

        style={[
          styles.content,
          {
            paddingHorizontal: horizontalPadding,
          },
        ]}

      >




        <Text

          style={[
            styles.title,
            {
              color: titleColor,
              fontSize: scaleFont(22),
            },
          ]}

        >

          Tu compañía para cuidar tus
          {'\n'}
          medicamentos cada día

        </Text>





        <View style={styles.features}>


          <Feature
            icon="notifications-outline"
            label="Recordatorios"
          />


          <Feature
            icon="camera-outline"
            label="Identificación"
          />



          <Feature
            icon="shield-checkmark-outline"
            label="Seguimiento"
          />


        </View>





        <View style={styles.spacer} />





        <View style={styles.actions}>



          <Pressable

            onPress={() =>
              navigation.navigate('Register')
            }

            style={({ pressed }) => [

              styles.primaryButton,

              {
                height: primaryHeight,

                backgroundColor:
                  isHighContrast
                    ? BrandColors.white
                    : BrandColors.navy,

                opacity:
                  pressed
                    ? 0.8
                    : 1,
              },

            ]}

          >


            <Text

              style={[
                styles.primaryText,
                {
                  color:
                    isHighContrast
                      ? '#000000'
                      : BrandColors.white,
                },
              ]}

            >

              Comenzar

            </Text>


          </Pressable>





          <Pressable

            onPress={() =>
              navigation.navigate('Login')
            }


            style={[
              styles.secondaryButton,
              {
                height: secondaryHeight,
              },
            ]}

          >



            <Text

              style={[
                styles.secondaryText,
                {
                  color: titleColor,
                },
              ]}

            >

              Ya tengo cuenta

            </Text>



            <Ionicons

              name="arrow-forward"

              size={17}

              color={titleColor}

            />


          </Pressable>


        </View>



      </View>



    </View>

  );







  return (

    <View

      style={[
        styles.root,
        {
          backgroundColor: bg,
        },
      ]}

    >


      {

        needsScroll

        ?

        <ScrollView

          showsVerticalScrollIndicator={false}

          contentContainerStyle={styles.scroll}

        >

          {content}

        </ScrollView>


        :

        content

      }


    </View>

  );

}





function Feature({

  icon,

  label,

}: {

  icon: keyof typeof Ionicons.glyphMap;

  label: string;

}) {


  return (

    <View style={styles.feature}>


      <View style={styles.iconCircle}>


        <Ionicons

          name={icon}

          size={25}

          color={BrandColors.navy}

        />


      </View>



      <Text

        style={styles.featureText}

      >

        {label}


      </Text>



    </View>


  );

}







const styles = StyleSheet.create({


  root:{
    flex:1,
  },



  scroll:{
    flexGrow:1,
  },



  column:{
    flex:1,
    width:'100%',
  },



  content:{
    flex:1,
    alignItems:'center',
  },



  title:{


    fontFamily:INTER_SEMIBOLD,

    fontWeight:'600',

    textAlign:'center',

    lineHeight:30,

    marginTop:90,

    maxWidth:340,


  },




  features:{


    flexDirection:'row',

    justifyContent:'space-evenly',

    alignItems:'center',

    width:'100%',

    marginTop:32,


  },




  feature:{


    alignItems:'center',

    justifyContent:'center',

    width:95,


  },




  iconCircle:{


    width:54,

    height:54,

    borderRadius:27,

    backgroundColor: BrandColors.skyBlue,

    alignItems:'center',

    justifyContent:'center',

    marginBottom:8,


  },




  featureText:{


    fontFamily:INTER,

    fontSize:13,

    fontWeight:'400',

    color:BrandColors.navy,

    textAlign:'center',


  },




  spacer:{


    flex:1,

    minHeight:35,


  },




  actions:{


    width:'100%',

    alignItems:'center',

    gap:12,


  },




  primaryButton:{


    width:'100%',

    maxWidth:380,

    borderRadius:Radius.lg,

    alignItems:'center',

    justifyContent:'center',


  },




  primaryText:{


    fontFamily:INTER_MEDIUM,

    fontSize:17,

    fontWeight:'500',


  },




  secondaryButton:{


    flexDirection:'row',

    alignItems:'center',

    justifyContent:'center',

    gap:7,


  },




  secondaryText:{
    fontFamily:INTER_MEDIUM,
    fontSize:16,
    fontWeight:'500',

  },

});