/** Base de datos de medicamentos para reconocimiento y consultas */
export interface MedicationDatabaseEntry {
  name: string;
  description: string;
  dose: string;
  category: string;
  aliases: string[];
}

export const MEDICATION_DATABASE: MedicationDatabaseEntry[] = [
  {
    name: 'Acetaminofén',
    description: 'Sirve para aliviar dolor leve a moderado y reducir la fiebre.',
    dose: '500mg',
    category: 'Analgésico',
    aliases: ['paracetamol', 'tylenol', 'dolex'],
  },
  {
    name: 'Ibuprofeno',
    description: 'Antiinflamatorio utilizado para dolor, inflamación y fiebre.',
    dose: '400mg',
    category: 'Antiinflamatorio',
    aliases: ['advil', 'motrin', 'ibuprofeno'],
  },
  {
    name: 'Losartán',
    description: 'Ayuda a controlar la presión arterial alta y proteger los riñones.',
    dose: '50mg',
    category: 'Antihipertensivo',
    aliases: ['losartan', 'cozaar'],
  },
  {
    name: 'Metformina',
    description: 'Ayuda a controlar los niveles de azúcar en sangre en la diabetes tipo 2.',
    dose: '850mg',
    category: 'Antidiabético',
    aliases: ['metformin', 'glucophage'],
  },
  {
    name: 'Omeprazol',
    description: 'Reduce la producción de ácido en el estómago. Útil para acidez y reflujo.',
    dose: '20mg',
    category: 'Protector gástrico',
    aliases: ['omeprazole', 'prilosec'],
  },
  {
    name: 'Atorvastatina',
    description: 'Ayuda a reducir el colesterol y prevenir enfermedades cardíacas.',
    dose: '20mg',
    category: 'Estatinas',
    aliases: ['atorvastatin', 'lipitor'],
  },
  {
    name: 'Amoxicilina',
    description: 'Antibiótico para tratar infecciones bacterianas.',
    dose: '500mg',
    category: 'Antibiótico',
    aliases: ['amoxicillin', 'amoxil'],
  },
  {
    name: 'Aspirina',
    description: 'Alivia el dolor, reduce la fiebre y ayuda a prevenir coágulos sanguíneos.',
    dose: '100mg',
    category: 'Analgésico',
    aliases: ['aspirin', 'ácido acetilsalicílico'],
  },
];

export function findMedication(query: string): MedicationDatabaseEntry | null {
  const normalized = query.toLowerCase().trim();
  return (
    MEDICATION_DATABASE.find(
      (med) =>
        med.name.toLowerCase().includes(normalized) ||
        med.aliases.some((alias) => alias.includes(normalized) || normalized.includes(alias))
    ) || null
  );
}
