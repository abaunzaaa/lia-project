export type ObservedIngredient = {
  name: string;
  strength: string | null;
};

export type ObservedPackage = {
  ingredients: ObservedIngredient[];
  presentation: string | null;
  route: string | null;
  manufacturer: string | null;
  sanitaryRegistry: string | null;
};

export interface RecognitionResult {
  name: string;
  description: string;
  dose: string;
  confidence: number;
  rxcui?: string | null;
  patientInfo?: unknown;
  voiceText?: string | null;
  identified?: boolean;
  observedPackage?: ObservedPackage | null;
  compositionVerified?: boolean;
}

/** Resultado crudo de visión Gemini (antes de enriquecer con referencia). */
export interface VisionRecognitionResult {
  name: string;
  identified: boolean;
  confidence: number;
  observedPackage?: ObservedPackage | null;
}

export interface ChatRequest {
  medicationName: string;
  question: string;
}

export interface ChatResponse {
  answer: string;
}

export interface MedicationInfo {
  name: string;
  description: string;
  dose: string;
  category: string;
}

export interface ApiError {
  error: string;
  message?: string;
}
