import * as Speech from 'expo-speech';

/** Idioma preferido (Colombia). El SO usa fallback en español si no hay voz es-CO. */
export const SPEECH_LANGUAGE = 'es-CO';

/** Velocidad calmada y clara para adultos mayores. */
export const SPEECH_RATE = 0.9;

export type SpeakOptions = {
  /** Identificador opcional para saber qué control está leyendo. */
  id?: string;
  language?: string;
  rate?: number;
  onErrorMessage?: (message: string) => void;
};

type SpeakingListener = (state: { speaking: boolean; activeId: string | null }) => void;

let speaking = false;
let activeId: string | null = null;
const listeners = new Set<SpeakingListener>();

function emit() {
  const snapshot = { speaking, activeId };
  listeners.forEach((listener) => listener(snapshot));
}

function setState(nextSpeaking: boolean, nextId: string | null) {
  speaking = nextSpeaking;
  activeId = nextId;
  emit();
}

export function getSpeakingState(): { speaking: boolean; activeId: string | null } {
  return { speaking, activeId };
}

export function isSpeaking(): boolean {
  return speaking;
}

export function subscribeSpeaking(listener: SpeakingListener): () => void {
  listeners.add(listener);
  listener(getSpeakingState());
  return () => {
    listeners.delete(listener);
  };
}

export async function stopSpeaking(): Promise<void> {
  try {
    await Speech.stop();
  } catch (error) {
    if (__DEV__) console.warn('[speech] stop failed', error);
  } finally {
    setState(false, null);
  }
}

/**
 * Lee texto en voz alta. Detiene cualquier lectura previa (sin superposición).
 */
export async function speakText(text: string, options?: SpeakOptions): Promise<void> {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return;

  const id = options?.id ?? null;

  try {
    await Speech.stop();
  } catch {
    /* ignore */
  }

  setState(true, id);

  try {
    Speech.speak(clean, {
      language: options?.language || SPEECH_LANGUAGE,
      rate: options?.rate ?? SPEECH_RATE,
      pitch: 1.0,
      onStart: () => setState(true, id),
      onDone: () => setState(false, null),
      onStopped: () => setState(false, null),
      onError: () => {
        setState(false, null);
        options?.onErrorMessage?.(
          'No pudimos reproducir la lectura en este momento.'
        );
        if (__DEV__) console.warn('[speech] speak error');
      },
    });
  } catch (error) {
    setState(false, null);
    options?.onErrorMessage?.('No pudimos reproducir la lectura en este momento.');
    if (__DEV__) console.warn('[speech] speak threw', error);
  }
}

export async function speakMedicationReminderPhrase(
  phrase: string,
  options?: SpeakOptions
): Promise<void> {
  return speakText(phrase, options);
}

export async function speakMedicationDetailsPhrase(
  phrase: string,
  options?: SpeakOptions
): Promise<void> {
  return speakText(phrase, options);
}

export async function speakReminderPhrase(
  phrase: string,
  options?: SpeakOptions
): Promise<void> {
  return speakText(phrase, options);
}

/** Confirmación breve al activar la preferencia (solo al encender). */
export async function speakVoiceEnabledConfirmation(): Promise<void> {
  return speakText('Lectura por voz activada.', { id: 'voice-enabled' });
}
