import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { brandImages } from '../config/brandAssets';
import { useTheme } from '../context/ThemeContext';

interface WelcomeBrandLogoProps {
  pageBackground?: string;
  size: number;
  elevated?: boolean;
}

export default function WelcomeBrandLogo({
  size,
}: WelcomeBrandLogoProps) {

  const { isDark, isHighContrast } = useTheme();

  const source =
    isDark || isHighContrast
      ? brandImages.logoWordmarkDark
      : brandImages.logoWordmark;


  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Logotipo de LIA"
      style={[
        styles.container,
        {
          width:size,
          height:size * 0.35,
        }
      ]}
    >

      <Image
        source={source}
        style={styles.logo}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />

    </View>
  );
}



const styles = StyleSheet.create({

container:{
  justifyContent:'center',
  alignItems:'center',
  backgroundColor:'transparent',
},


logo:{
  width:'100%',
  height:'100%',
},


});