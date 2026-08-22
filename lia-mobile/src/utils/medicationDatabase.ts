/** Base local de medicamentos (sin cámara / offline) */
export interface LocalMedication {
  name: string;
  description: string;
  dose: string;
  aliases: string[];
}

export const LOCAL_MEDICATIONS: LocalMedication[] = [
  {
    name: 'Acetaminofén',
    description: 'Sirve para aliviar dolor leve a moderado y reducir la fiebre.',
    dose: '500mg',
    aliases: ['paracetamol', 'tylenol', 'dolex'],
  },
  {
    name: 'Ibuprofeno',
    description: 'Antiinflamatorio utilizado para dolor, inflamación y fiebre.',
    dose: '400mg',
    aliases: ['advil', 'motrin'],
  },
  {
    name: 'Losartán',
    description: 'Ayuda a controlar la presión arterial alta y proteger los riñones.',
    dose: '50mg',
    aliases: ['losartan', 'cozaar'],
  },
  {
    name: 'Metformina',
    description: 'Ayuda a controlar los niveles de azúcar en sangre en la diabetes tipo 2.',
    dose: '850mg',
    aliases: ['metformin', 'glucophage'],
  },
  {
    name: 'Omeprazol',
    description: 'Reduce la producción de ácido en el estómago. Útil para acidez y reflujo.',
    dose: '20mg',
    aliases: ['omeprazole', 'prilosec'],
  },
  {
    name: 'Atorvastatina',
    description: 'Ayuda a reducir el colesterol y prevenir enfermedades cardíacas.',
    dose: '20mg',
    aliases: ['atorvastatin', 'lipitor'],
  },
  {
    name: 'Amoxicilina',
    description: 'Antibiótico para tratar infecciones bacterianas.',
    dose: '500mg',
    aliases: ['amoxicillin', 'amoxil'],
  },
  {
    name: 'Aspirina',
    description: 'Alivia el dolor, reduce la fiebre y ayuda a prevenir coágulos sanguíneos.',
    dose: '100mg',
    aliases: ['aspirin', 'ácido acetilsalicílico'],
  },
];

export function searchLocalMedication(query: string): LocalMedication | null {
  const q = query.toLowerCase().trim();
  return (
    LOCAL_MEDICATIONS.find(
      (med) =>
        med.name.toLowerCase().includes(q) ||
        med.aliases.some((a) => a.includes(q) || q.includes(a))
    ) || null
  );
}

/** Simula un resultado de IA sin cámara */
export function simulateRecognition() {
  const med = LOCAL_MEDICATIONS[Math.floor(Math.random() * LOCAL_MEDICATIONS.length)];
  return {
    name: med.name,
    description: med.description,
    dose: med.dose,
    confidence: Math.floor(Math.random() * 8) + 90,
  };
}
