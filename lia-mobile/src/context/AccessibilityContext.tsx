import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { stopSpeaking } from '../services/speechService';

export type AccessibilityMode = 'normal' | 'senior';
export type TextSize = 'sm' | 'md' | 'lg';

const MODE_KEY = 'lia_accessibility_mode';
const TEXT_SIZE_KEY = 'lia_text_size';
const VOICE_KEY = 'lia_voice_enabled';

const TEXT_SIZE_SCALE: Record<TextSize, number> = {
  sm: 0.92,
  md: 1,
  lg: 1.18,
};

const SENIOR_FONT = 1.22;
const SENIOR_BUTTON = 1.28;
const SENIOR_SPACING = 1.16;

interface AccessibilityContextType {
  mode: AccessibilityMode;
  isSeniorMode: boolean;
  toggleSeniorMode: () => void;
  setSeniorMode: (enabled: boolean) => void;
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
  voiceEnabled: boolean;
  setVoiceEnabled: (enabled: boolean) => void;
  fontScale: number;
  buttonScale: number;
  spacingScale: number;
  scaleFont: (size: number) => number;
  scaleSpacing: (size: number) => number;
  minTouch: number;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AccessibilityMode>('normal');
  const [textSize, setTextSizeState] = useState<TextSize>('md');
  const [voiceEnabled, setVoiceState] = useState(true);

  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync(MODE_KEY),
      SecureStore.getItemAsync(TEXT_SIZE_KEY),
      SecureStore.getItemAsync(VOICE_KEY),
    ]).then(([storedMode, storedSize, storedVoice]) => {
      if (storedMode === 'senior') setMode('senior');
      if (storedSize === 'sm' || storedSize === 'md' || storedSize === 'lg') {
        setTextSizeState(storedSize);
      }
      if (storedVoice === 'false') setVoiceState(false);
    });
  }, []);

  const setSeniorMode = useCallback(async (enabled: boolean) => {
    const next: AccessibilityMode = enabled ? 'senior' : 'normal';
    setMode(next);
    await SecureStore.setItemAsync(MODE_KEY, next);
  }, []);

  const toggleSeniorMode = useCallback(() => {
    setSeniorMode(mode !== 'senior');
  }, [mode, setSeniorMode]);

  const setTextSize = useCallback(async (size: TextSize) => {
    setTextSizeState(size);
    await SecureStore.setItemAsync(TEXT_SIZE_KEY, size);
  }, []);

  const setVoiceEnabled = useCallback(async (enabled: boolean) => {
    if (!enabled) {
      await stopSpeaking();
    }
    setVoiceState(enabled);
    await SecureStore.setItemAsync(VOICE_KEY, enabled ? 'true' : 'false');
  }, []);

  const value = useMemo<AccessibilityContextType>(() => {
    const isSeniorMode = mode === 'senior';
    const fontScale = TEXT_SIZE_SCALE[textSize] * (isSeniorMode ? SENIOR_FONT : 1);
    const buttonScale = (isSeniorMode ? SENIOR_BUTTON : 1) * (textSize === 'lg' ? 1.06 : 1);
    const spacingScale = (isSeniorMode ? SENIOR_SPACING : 1) * (textSize === 'lg' ? 1.08 : 1);

    return {
      mode,
      isSeniorMode,
      toggleSeniorMode,
      setSeniorMode,
      textSize,
      setTextSize,
      voiceEnabled,
      setVoiceEnabled,
      fontScale,
      buttonScale,
      spacingScale,
      scaleFont: (size) => Math.round(size * fontScale),
      scaleSpacing: (size) => Math.round(size * spacingScale),
      minTouch: Math.round(48 * (isSeniorMode ? 1.12 : 1)),
    };
  }, [mode, textSize, voiceEnabled, toggleSeniorMode, setSeniorMode, setTextSize, setVoiceEnabled]);

  return (
    <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) throw new Error('useAccessibility debe usarse dentro de AccessibilityProvider');
  return context;
}
