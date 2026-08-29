import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface WelcomeHeroProps {
  height: number;
}

export default function WelcomeHero({ height }: WelcomeHeroProps) {

  const { isHighContrast } = useTheme();


  if (isHighContrast) {
    return (
      <View
        style={[
          styles.container,
          {
            height,
            backgroundColor:'#000000',
          }
        ]}
      />
    );
  }


  return (

    <View
      style={[
        styles.container,
        {
          height,
          backgroundColor:'#FFFFFF',
        }
      ]}
    >


      {/* LOGO LÍA */}

      <Image

        source={require('../assets/images/lia-logo-wordmark.png')}

        style={styles.logo}

        resizeMode="contain"

      />



      {/* CÍRCULO */}

      <View

        style={styles.circle}

      />



      {/* ADULTOS MAYORES */}

      <Image

        source={require('../assets/images/lia-seniors2.png')}

        style={styles.people}

        resizeMode="contain"

      />



    </View>

  );

}



const styles = StyleSheet.create({


container:{

  width:'100%',

  alignItems:'center',

  justifyContent:'center',

  position:'relative',

},



logo:{


  position:'absolute',
  width:280,
  height:200,
  top:50,
  zIndex:5,


},


circle:{

  position:'absolute',
  width:310,
  height:310,
  borderRadius:155,
  top:240,
  backgroundColor:'#D9EAF6',

},

people:{

  width:360,
  height:400,
  marginTop:280,
  zIndex:2,

},



});