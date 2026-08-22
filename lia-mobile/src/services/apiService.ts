import { API_BASE_URL } from '../config/api';
import { RecognitionResult } from '../types';

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  /** Reconocimiento por imagen — desactivado hasta conectar cámara */
  async recognizeMedication(_imageUri: string): Promise<RecognitionResult> {
    throw new Error('Reconocimiento por cámara no disponible aún');
  }

  /** Chat con LIA sobre un medicamento */
  async askLIA(medicationName: string, question: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/medications/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medicationName, question }),
    });

    if (!response.ok) {
      throw new Error('Error al consultar a LIA');
    }

    const data = await response.json();
    return data.answer;
  }

  /** Obtener información de un medicamento */
  async getMedicationInfo(name: string): Promise<{ description: string; dose: string }> {
    const response = await fetch(`${this.baseUrl}/medications/info?name=${encodeURIComponent(name)}`);

    if (!response.ok) {
      throw new Error('Medicamento no encontrado');
    }

    return response.json();
  }

  /** Health check del backend */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const apiService = new ApiService();
