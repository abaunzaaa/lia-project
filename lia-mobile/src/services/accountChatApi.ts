import { apiRequest, authHeaders, ApiClientError } from './apiClient';
import {
  DRUG_CHAT_MAX_HISTORY,
  DRUG_CHAT_MAX_MESSAGE,
  DrugChatHistoryItem,
  DrugChatResponseData,
} from './drugChatApi';

type ApiSuccessBody = {
  success: boolean;
  data?: DrugChatResponseData;
  message?: string;
};

function mapAccountChatError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) {
    if (error.status === 429) {
      return new ApiClientError(
        'LIA está recibiendo varias preguntas en este momento. Espera un momento y vuelve a intentarlo.',
        429
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
    'No pude consultar tus medicamentos en este momento. Inténtalo nuevamente.',
    undefined
  );
}

/**
 * POST /api/drug-reference/account-chat
 * Una sola solicitud por pregunta. No usa el chat de un medicamento individual.
 */
export async function sendAccountChatMessage(params: {
  message: string;
  history?: DrugChatHistoryItem[];
}): Promise<DrugChatResponseData> {
  const message = params.message.trim();
  if (!message) {
    throw new ApiClientError('Escribe una pregunta.', 400);
  }
  if (message.length > DRUG_CHAT_MAX_MESSAGE) {
    throw new ApiClientError('El mensaje es demasiado largo (máximo 1000 caracteres).', 400);
  }

  const history = (params.history ?? [])
    .filter((item) => item.role === 'user' || item.role === 'assistant')
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, 800),
    }))
    .filter((item) => item.content.length > 0)
    .slice(-DRUG_CHAT_MAX_HISTORY);

  try {
    const headers = await authHeaders();
    const response = await apiRequest('/drug-reference/account-chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({ message, history }),
    });
    const json = (await response.json()) as ApiSuccessBody;
    if (!json.data?.message) {
      throw new ApiClientError('No pudimos leer la respuesta de LÍA.', response.status);
    }
    return json.data;
  } catch (error) {
    throw mapAccountChatError(error);
  }
}

export { DRUG_CHAT_MAX_MESSAGE, DRUG_CHAT_MAX_HISTORY };
export type { DrugChatHistoryItem };
