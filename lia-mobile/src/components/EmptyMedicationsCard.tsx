import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { BrandColors } from '../theme/brand';
import AppText from './AppText';

const HOME_CARD_IMAGE = require('../assets/images/homecard.png');

const TITLE = 'Registra tu primer medicamento';
const DESCRIPTION =
  'Aún no tienes medicamentos registrados, identifícalo con LIA y lleva un mejor control de tus tomas';

export default function EmptyMedicationsCard() {
  const { colors, isHighContrast, isDark } = useTheme();
  const lightChrome = !isDark && !isHighContrast;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${TITLE}. ${DESCRIPTION}.`}
      style={[
        styles.card,
        {
          backgroundColor: lightChrome ? BrandColors.white : colors.surface,
          borderColor: isHighContrast ? colors.border : '#F0F1F2',
          borderWidth: isHighContrast ? 2 : 1,
        },
      ]}
    >
      <View style={styles.art} pointerEvents="none">
        <Image
          source={HOME_CARD_IMAGE}
          style={styles.image}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>

      <View style={styles.copy}>
        <AppText
          variant="h3"
          style={{
            color: lightChrome ? BrandColors.navy : colors.textPrimary,
            fontWeight: '600',
          }}
        >
          {TITLE}
        </AppText>
        <AppText
          variant="body"
          style={{
            color: lightChrome ? BrandColors.teal : colors.textSecondary,
            marginTop: 8,
          }}
        >
          {DESCRIPTION}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderRadius: 24,
    paddingVertical: 22,
    paddingLeft: 12,
    paddingRight: 20,
    minHeight: 156,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 2,
  },
  art: {
    width: 128,
    height: 144,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 8,
  },
});
