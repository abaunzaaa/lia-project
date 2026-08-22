import { DoseStatus, Medication, Reminder } from '../types';
import { toHHmm } from '../utils/helpers';

const HOUR_WORDS: Record<number, string> = {
  1: 'una',
  2: 'dos',
  3: 'tres',
  4: 'cuatro',
  5: 'cinco',
  6: 'seis',
  7: 'siete',
  8: 'ocho',
  9: 'nueve',
  10: 'diez',
  11: 'once',
  12: 'doce',
};

const FREQUENCY_SPOKEN: Record<string, string> = {
  '8h': 'cada ocho horas',
  '12h': 'cada doce horas',
  '24h': 'una vez al día',
  '2x': 'dos veces al día',
  '3x': 'tres veces al día',
  prn: 'según necesidad',
};

/** Convierte dosis técnicas a frase hablada sin reinterpretar el valor médico. */
export function speakableDose(dose: string): string {
  const trimmed = dose.trim();
  if (!trimmed) return '';

  return trimmed
    .replace(/(\d+(?:[.,]\d+)?)\s*mg\b/gi, '$1 miligramos')
    .replace(/(\d+(?:[.,]\d+)?)\s*mcg\b/gi, '$1 microgramos')
    .replace(/(\d+(?:[.,]\d+)?)\s*ml\b/gi, '$1 mililitros')
    .replace(/(\d+(?:[.,]\d+)?)\s*g\b/gi, '$1 gramos')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * HH:mm → frase natural en español.
 * 08:00 → "ocho de la mañana"
 * 20:00 → "ocho de la noche"
 */
export function speakableTime(time: string): string {
  const hhmm = toHHmm(time) || time.trim();
  const match = hhmm.match(/^(\d{1,2}):([0-5]\d)/);
  if (!match) return time;

  const hour24 = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (Number.isNaN(hour24) || hour24 > 23) return time;

  const period =
    hour24 < 12 ? 'de la mañana' : hour24 < 19 ? 'de la tarde' : 'de la noche';

  let displayHour = hour24 % 12;
  if (displayHour === 0) displayHour = 12;

  const hourWord = HOUR_WORDS[displayHour] || String(displayHour);

  if (minutes === 0) {
    if (hour24 === 0) return 'doce de la noche';
    if (hour24 === 12) return 'doce del mediodía';
    return `${hourWord} ${period}`;
  }

  if (minutes === 30) {
    return `${hourWord} y media ${period}`;
  }

  return `${hourWord} y ${minutes} ${period}`;
}

export function speakableTimes(times: string[]): string {
  const spoken = times.map(speakableTime).filter(Boolean);
  if (spoken.length === 0) return '';
  if (spoken.length === 1) return spoken[0];
  if (spoken.length === 2) return `${spoken[0]} y ${spoken[1]}`;
  const last = spoken[spoken.length - 1];
  return `${spoken.slice(0, -1).join(', ')} y ${last}`;
}

function scheduleTimesOf(med: Medication): string[] {
  if (med.schedules?.length) return med.schedules.map((s) => s.time);
  return med.time ? [med.time] : [];
}

export function buildNextDoseSpeech(input: {
  time: string;
  items: { medicationName: string; dose: string }[];
}): string {
  const time = speakableTime(input.time);
  const items = input.items;
  if (items.length === 0) {
    return `Tu próxima toma es a las ${time}.`;
  }
  if (items.length === 1) {
    const dose = speakableDose(items[0].dose);
    const dosePart = dose ? `, ${dose}` : '';
    return `Tu próxima toma es ${items[0].medicationName}${dosePart}, a las ${time}.`;
  }

  const count = items.length;
  const lines = items.map((item, index) => {
    const dose = speakableDose(item.dose);
    const dosePart = dose ? `, ${dose}` : '';
    const name = `${item.medicationName}${dosePart}.`;
    if (index === items.length - 1) return `Y ${name}`;
    return name;
  });

  return `Tu próxima toma es a las ${time}. Tienes ${count} medicamentos programados: ${lines.join(' ')}`;
}

export function buildMedicationDetailsSpeech(med: Medication): string {
  const parts: string[] = [med.name];

  if (med.dose) {
    parts.push(`Dosis: ${speakableDose(med.dose)}.`);
  }

  const times = scheduleTimesOf(med);
  if (times.length) {
    parts.push(`Debes tomarlo a las ${speakableTimes(times)}.`);
  }

  if (med.frequency) {
    const freq = FREQUENCY_SPOKEN[med.frequency] || med.frequency;
    parts.push(`Frecuencia: ${freq}.`);
  }

  if (med.description?.trim()) {
    parts.push(`Indicaciones: ${med.description.trim()}.`);
  }

  return parts.join(' ');
}

export function buildReminderSpeech(reminder: Reminder): string {
  const dose = speakableDose(reminder.dose);
  const dosePart = dose ? `, ${dose}` : '';
  const time = speakableTime(reminder.scheduledTime);
  const name = reminder.medicationName;

  switch (reminder.status as DoseStatus) {
    case 'taken':
      return `${name}${dosePart}. Esta toma está marcada como tomada.`;
    case 'skipped':
      return `${name}${dosePart}. Esta toma está marcada como omitida.`;
    case 'missed':
      return `${name}${dosePart}. Esta toma quedó sin registrar.`;
    case 'pending':
    default:
      return `Es hora de ${name}${dosePart}. La toma está programada para las ${time}.`;
  }
}

export function buildRecognitionResultSpeech(input: {
  name: string;
  description?: string;
  dose?: string;
}): string {
  const parts = [input.name.trim()];
  if (input.description?.trim()) {
    parts.push(input.description.trim());
  }
  if (input.dose?.trim()) {
    parts.push(`Dosis sugerida: ${speakableDose(input.dose)}.`);
  }
  return parts.filter(Boolean).join('. ');
}

export const SPEECH_TAKEN_OK = 'Listo. Registré esta toma como tomada.';
export const SPEECH_SKIPPED_OK = 'Esta toma quedó registrada como omitida.';
export const SPEECH_MED_ADDED_OK = 'Medicamento agregado correctamente.';

export const SPEECH_CAMERA_GUIDE =
  'Primero, ubica la cámara en un lugar estable. Luego, coloca el medicamento frente a la cámara, dejando una distancia aproximada de 15 a 20 centímetros. Después, mantén oprimido el botón rojo por unos segundos. Verás un flash blanco y luego deberás esperar la respuesta de LIA.';

const SPEECH_SECTION_LIMIT = 320;
const SPEECH_MAX_BULLETS = 3;

function spokenSection(text: string, limit = SPEECH_SECTION_LIMIT): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit);
  const sentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('。'));
  if (sentenceEnd > limit * 0.45) {
    return cut.slice(0, sentenceEnd + 1).trim();
  }
  const space = cut.lastIndexOf(' ');
  return `${(space > 0 ? cut.slice(0, space) : cut).trim()}.`;
}

function spokenBullets(items: string[], max = SPEECH_MAX_BULLETS): string {
  const clean = items.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (!clean.length) return '';
  const picked = clean.slice(0, max).map((item) => spokenSection(item, 180));
  return picked.join(' ');
}

/** Lectura de PatientDrugInfo (español). No usa labels crudos EN. */
export function buildDrugInfoSpeech(info: {
  name: string;
  purpose?: string | null;
  importantInformation?: string[];
  precautions?: string[];
}): string {
  const parts: string[] = [info.name.trim()];

  if (info.purpose?.trim()) {
    parts.push(`Se utiliza para: ${spokenSection(info.purpose)}.`);
  }

  const important = spokenBullets(info.importantInformation ?? []);
  if (important) {
    parts.push(`Información importante: ${important}`);
  }

  const precautions = spokenBullets(info.precautions ?? []);
  if (precautions) {
    parts.push(`Precauciones: ${precautions}`);
  }

  return parts.join(' ');
}
