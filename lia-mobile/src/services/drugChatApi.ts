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

function mapChatError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) {
    if (error.status === 429) {
      return new ApiClientError(
        'LIA está recibiendo varias preguntas en este momento. Espera un momento y vuelve a intentarlo.',
        429
      );
    }
    if (error.status === 502 || error.status === 503 || error.status === 504) {
      return new ApiClientError(
        'No pude consultar la información del medicamento en este momento. Inténtalo nuevamente.',
        error.status
      );
    }
    if (error.status === undefined) {
      return new ApiClientError(
        'No pude conectarme en este momento. Revisa tu conexión e inténtalo nuevamente.',
        undefined
      );
    }
    return error;
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
      message: json.data.message,
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
