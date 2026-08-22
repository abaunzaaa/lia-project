export interface RecognitionResult {
  name: string;
  description: string;
  dose: string;
  confidence: number;
  rxcui?: string | null;
  patientInfo?: unknown;
  voiceText?: string | null;
  identified?: boolean;
}

/** Resultado crudo de visión Gemini (antes de enriquecer con referencia). */
export interface VisionRecognitionResult {
  name: string;
  identified: boolean;
  confidence: number;
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
