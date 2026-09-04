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
import { ColorPalette, ColorScheme, getShadows, resolvePalette } from '../theme/themes';
import { ViewStyle } from 'react-native';

interface ThemeContextType {
  appearance: ColorScheme;
  setAppearance: (next: ColorScheme) => void;
  colors: ColorPalette;
  shadows: Record<'none' | 'sm' | 'md' | 'lg', ViewStyle>;
  isDark: boolean;
  isHighContrast: boolean;
  setHighContrast: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const APPEARANCE_KEY = 'lia_appearance';
const HIGH_CONTRAST_KEY = 'lia_high_contrast';

function parseScheme(value: string | null): ColorScheme | 'legacy-hc' | null {
  if (value === 'light' || value === 'dark') return value;
  if (value === 'highContrast') return 'legacy-hc';
  return null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<ColorScheme>('light');
  const [highContrast, setHighContrastState] = useState(false);

  useEffect(() => {
    void (async () => {
      const storedScheme = parseScheme(await SecureStore.getItemAsync(APPEARANCE_KEY));
      const storedHc = await SecureStore.getItemAsync(HIGH_CONTRAST_KEY);

      if (storedScheme === 'legacy-hc') {
        setAppearanceState('light');
        setHighContrastState(true);
        await SecureStore.setItemAsync(APPEARANCE_KEY, 'light');
        await SecureStore.setItemAsync(HIGH_CONTRAST_KEY, '1');
        return;
      }

      if (storedScheme === 'light' || storedScheme === 'dark') {
        setAppearanceState(storedScheme);
      }

      if (storedHc === '1' || storedHc === 'true') {
        setHighContrastState(true);
      }
    })();
  }, []);

  const setAppearance = useCallback(async (next: ColorScheme) => {
    setAppearanceState(next);
    await SecureStore.setItemAsync(APPEARANCE_KEY, next);
  }, []);

  const setHighContrast = useCallback(async (enabled: boolean) => {
    setHighContrastState(enabled);
    await SecureStore.setItemAsync(HIGH_CONTRAST_KEY, enabled ? '1' : '0');
  }, []);

  const value = useMemo<ThemeContextType>(
    () => ({
      appearance,
      setAppearance,
      colors: resolvePalette(appearance, highContrast),
      shadows: getShadows(appearance, highContrast),
      isDark: appearance === 'dark',
      isHighContrast: highContrast,
      setHighContrast,
    }),
    [appearance, highContrast, setAppearance, setHighContrast]
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
