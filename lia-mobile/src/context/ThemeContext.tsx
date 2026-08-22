import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { Appearance, ColorPalette, getShadows, palettes } from '../theme/themes';
import { ViewStyle } from 'react-native';

interface ThemeContextType {
  appearance: Appearance;
  setAppearance: (next: Appearance) => void;
  colors: ColorPalette;
  shadows: Record<'none' | 'sm' | 'md' | 'lg', ViewStyle>;
  isDark: boolean;
  isHighContrast: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const APPEARANCE_KEY = 'lia_appearance';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<Appearance>('light');

  useEffect(() => {
    SecureStore.getItemAsync(APPEARANCE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'highContrast') {
        setAppearanceState(stored);
      }
    });
  }, []);

  const setAppearance = useCallback(async (next: Appearance) => {
    setAppearanceState(next);
    await SecureStore.setItemAsync(APPEARANCE_KEY, next);
  }, []);

  const value = useMemo<ThemeContextType>(
    () => ({
      appearance,
      setAppearance,
      colors: palettes[appearance],
      shadows: getShadows(appearance),
      isDark: appearance !== 'light',
      isHighContrast: appearance === 'highContrast',
    }),
    [appearance, setAppearance]
  );

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style={value.isDark ? 'light' : 'dark'} />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return context;
}
