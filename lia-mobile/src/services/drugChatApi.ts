import { apiRequest, authHeaders, ApiClientError } from './apiClient';

export const DRUG_CHAT_MAX_MESSAGE = 1000;
export const DRUG_CHAT_MAX_HISTORY = 10;

export type DrugChatHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
};

export type DrugChatMedicationRef = {
  rxcui?: string;
  name?: string;
};

export type DrugChatRequest = {
  medication: DrugChatMedicationRef;
  message: string;
  history?: DrugChatHistoryItem[];
  registeredDose?: string;
  registeredPurpose?: string;
  registeredPresentation?: string;
  registeredNotes?: string;
};

export type DrugChatResponseData = {
  message: string;
  medication: {
    id: string | null;
    name: string;
  };
  source: {
    name: string;
    reference: string | null;
  } | null;
  grounded: boolean;
};

type ApiSuccessBody = {
  success: boolean;
  data?: DrugChatResponseData;
  message?: string;
};

const ASSISTANT_UNAVAILABLE =
  'En este momento no puedo consultar más información. Puedes intentarlo más tarde.';

function visibleChatText(message: string): string {
  if (
    /AI_API_KEY|process\.env|gemini-|\bHTTP\s*\d{3}\b|cuota diaria|AI_MODEL|AI_CHAT|clave con m[aá]s cupo/i.test(
      message
    )
  ) {
    return ASSISTANT_UNAVAILABLE;
  }
  return message;
}

function mapChatError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) {
    if (error.status === 429) {
      return new ApiClientError(visibleChatText(error.message), error.status);
    }
    if (error.status === undefined) {
      return new ApiClientError(
        'No pude conectarme en este momento. Revisa tu conexión e inténtalo nuevamente.',
        undefined
      );
    }
    return new ApiClientError(visibleChatText(error.message), error.status);
  }
  return new ApiClientError(
    'No pude consultar la información del medicamento en este momento. Inténtalo nuevamente.',
    undefined
  );
}

/**
 * POST /api/drug-reference/chat
 * Una sola solicitud por pregunta. Sin reintentos automáticos.
 */
export async function sendDrugChatMessage(
  params: DrugChatRequest
): Promise<DrugChatResponseData> {
  const message = params.message.trim();
  if (!message) {
    throw new ApiClientError('Escribe una pregunta.', 400);
  }
  if (message.length > DRUG_CHAT_MAX_MESSAGE) {
    throw new ApiClientError('El mensaje es demasiado largo (máximo 1000 caracteres).', 400);
  }

  const medication: DrugChatMedicationRef = {};
  if (params.medication.rxcui?.trim()) {
    medication.rxcui = params.medication.rxcui.trim();
  }
  if (params.medication.name?.trim()) {
    medication.name = params.medication.name.trim();
  }
  if (!medication.rxcui && !medication.name) {
    throw new ApiClientError('No encontramos el medicamento para esta consulta.', 400);
  }

  const history = (params.history ?? [])
    .filter((h) => h.role === 'user' || h.role === 'assistant')
    .map((h) => ({
      role: h.role,
      content: h.content.trim().slice(0, 800),
    }))
    .filter((h) => h.content.length > 0)
    .slice(-DRUG_CHAT_MAX_HISTORY);

  const body: DrugChatRequest = {
    medication,
    message,
    history,
  };

  if (params.registeredDose?.trim()) {
    body.registeredDose = params.registeredDose.trim().slice(0, 100);
  }
  if (params.registeredPurpose?.trim()) {
    body.registeredPurpose = params.registeredPurpose.trim().slice(0, 200);
  }
  if (params.registeredPresentation?.trim()) {
    body.registeredPresentation = params.registeredPresentation.trim().slice(0, 80);
  }
  if (params.registeredNotes?.trim()) {
    body.registeredNotes = params.registeredNotes.trim().slice(0, 500);
  }

  try {
    const headers = await authHeaders();
    const response = await apiRequest('/drug-reference/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const json = (await response.json()) as ApiSuccessBody;
    if (!json.data?.message) {
      throw new ApiClientError(
        'No pude consultar la información del medicamento en este momento. Inténtalo nuevamente.',
        502
      );
    }

    return {
      message: visibleChatText(json.data.message),
      medication: {
        id: json.data.medication?.id ?? null,
        name: json.data.medication?.name ?? medication.name ?? '',
      },
      source: json.data.source
        ? {
            name: json.data.source.name,
            reference: json.data.source.reference ?? null,
          }
        : null,
      grounded: Boolean(json.data.grounded),
    };
  } catch (error) {
    throw mapChatError(error);
  }
}

export { ApiClientError as DrugChatApiError };
