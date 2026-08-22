import { useCallback, useEffect, useState } from 'react';
import {
  getSpeakingState,
  speakText,
  stopSpeaking,
  subscribeSpeaking,
  SpeakOptions,
} from '../services/speechService';
import { useAccessibility } from '../context/AccessibilityContext';

/**
 * Hook ligero para TTS de LÍA.
 * Respeta voiceEnabled y expone speak/stop + estado.
 */
export function useSpeech() {
  const { voiceEnabled } = useAccessibility();
  const [{ speaking, activeId }, setState] = useState(getSpeakingState);

  useEffect(() => subscribeSpeaking(setState), []);

  const speak = useCallback(
    async (text: string, options?: SpeakOptions) => {
      if (!voiceEnabled && !options?.id?.startsWith('voice-enabled')) {
        return;
      }
      await speakText(text, {
        ...options,
      });
    },
    [voiceEnabled]
  );

  const stop = useCallback(async () => {
    await stopSpeaking();
  }, []);

  const toggle = useCallback(
    async (text: string, id: string) => {
      if (speaking && activeId === id) {
        await stopSpeaking();
        return;
      }
      await speak(text, { id });
    },
    [speaking, activeId, speak]
  );

  return {
    voiceEnabled,
    speaking,
    activeId,
    speak,
    stop,
    toggle,
    isActive: (id: string) => speaking && activeId === id,
  };
}
