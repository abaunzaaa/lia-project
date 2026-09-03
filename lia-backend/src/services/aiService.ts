import { VisionRecognitionResult } from '../models/types';
import { findMedication } from '../models/medicationDatabase';
import { config } from '../config';

export class AiProviderError extends Error {
  constructor(
    message: string,
    public kind: 'not_configured' | 'timeout' | 'http' | 'invalid_response' | 'network',
    public httpStatus?: number
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string; thought?: boolean }>;
    };
    finishReason?: string;
  }>;
  error?: {
    code?: number | string;
    status?: string;
    message?: string;
  };
}

const DEFAULT_GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const TRANSIENT_GEMINI_HTTP = new Set([408, 429, 500, 502, 503, 504]);
const MAX_GEMINI_RETRIES = 2;

function isDev(): boolean {
  return (process.env.NODE_ENV || 'development') !== 'production';
}

function isTransientGeminiHttp(status?: number): boolean {
  return typeof status === 'number' && TRANSIENT_GEMINI_HTTP.has(status);
}

function geminiRetryDelayMs(retryNumber: number): number {
  const baseMs = 1000 * 2 ** (retryNumber - 1);
  const jitterMs = Math.floor(Math.random() * 400) - 200;
  return Math.max(500, baseMs + jitterMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractGeminiVisibleText(data: GeminiGenerateResponse): string {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((part) => part.thought !== true)
    .map((part) => part.text ?? '')
    .join('')
    .trim();
}

function normalizeGeminiBaseUrl(raw?: string | null): string {
  const base = (raw || DEFAULT_GEMINI_BASE).trim().replace(/\/+$/, '');
  return base;
}

function isGeminiApiBase(urlString?: string | null): boolean {
  if (!urlString) return false;
  try {
    const host = new URL(urlString).hostname;
    return host === 'generativelanguage.googleapis.com';
  } catch {
    return false;
  }
}

/**
 * Servicio de IA compartido de LÍA.
 * Reconocimiento/chat legacy + generación JSON (Gemini / endpoint custom).
 */
class AIService {
  isConfigured(): boolean {
    return Boolean(config.ai.apiKey || config.ai.serviceUrl);
  }

  /**
   * Reconocer medicamento desde buffer de imagen con Gemini Vision (modelo de chat).
   * Sin mocks ni catálogo aleatorio.
   */
  async recognizeFromImage(
    imageBuffer: Buffer,
    deviceId?: string
  ): Promise<VisionRecognitionResult> {
    console.log(
      `🔍 Procesando imagen (${imageBuffer.length} bytes)${deviceId ? ` desde ${deviceId}` : ''}`
    );

    if (!this.isConfigured()) {
      throw new AiProviderError(
        'IA no configurada. Define AI_API_KEY (y opcionalmente AI_SERVICE_URL) para reconocimiento.',
        'not_configured'
      );
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      throw new AiProviderError('Imagen vacía.', 'invalid_response');
    }

    return this.callGeminiVisionRecognition(imageBuffer);
  }

  private async callGeminiVisionRecognition(imageBuffer: Buffer): Promise<VisionRecognitionResult> {
    const apiKey = config.ai.apiKey?.trim();
    if (!apiKey) {
      throw new AiProviderError('IA no configurada (falta AI_API_KEY).', 'not_configured');
    }

    if (!config.ai.serviceUrl || isGeminiApiBase(config.ai.serviceUrl)) {
      const model = this.resolveGeminiModel(undefined, config.ai.chatModel);
      const { url, baseUrl } = this.buildGeminiGenerateUrl(model);
      if (isDev()) {
        console.log(`[gemini] vision model=${model}`);
      }

      const systemInstruction = `Eres un asistente de reconocimiento de medicamentos.
Identifica el nombre del medicamento a partir de una foto del empaque.
Responde SIEMPRE en español y SOLO con JSON válido de la forma:
{"name":"nombre del medicamento o cadena vacía","identified":true o false}
No inventes medicamentos. Si no puedes leer el empaque con claridad, identified=false y name="".`;

      const userText =
        'Identifica el medicamento en esta foto del empaque. Devuelve JSON {"name":"...","identified":true/false}.';

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: imageBuffer.toString('base64'),
                    },
                  },
                  { text: userText },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
              maxOutputTokens: 256,
            },
          }),
        });

        const rawText = await response.text();
        let parsedBody: unknown = null;
        try {
          parsedBody = rawText ? JSON.parse(rawText) : null;
        } catch {
          parsedBody = null;
        }

        if (!response.ok) {
          this.logGeminiHttpError({
            status: response.status,
            statusText: response.statusText,
            model,
            baseUrl,
            body: parsedBody,
          });

          const googleMessage =
            parsedBody &&
            typeof parsedBody === 'object' &&
            (parsedBody as GeminiGenerateResponse).error?.message
              ? String((parsedBody as GeminiGenerateResponse).error?.message)
              : `Error HTTP ${response.status} del proveedor de IA.`;

          throw new AiProviderError(googleMessage, 'http', response.status);
        }

        const data = (parsedBody || {}) as GeminiGenerateResponse;
        const text = data.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? '')
          .join('')
          .trim();

        if (!text) {
          throw new AiProviderError('La IA no devolvió contenido.', 'invalid_response');
        }

        return this.parseVisionResult(this.parseJsonLoose(text));
      } catch (error) {
        if (error instanceof AiProviderError) throw error;
        if (error instanceof Error && error.name === 'AbortError') {
          throw new AiProviderError('Timeout del proveedor de IA.', 'timeout');
        }
        throw new AiProviderError('No se pudo contactar el proveedor de IA.', 'network');
      } finally {
        clearTimeout(timer);
      }
    }

    // Endpoint custom: envía imagen en base64
    const data = await this.callCustomJsonEndpoint({
      systemInstruction:
        'Identifica el medicamento en la foto. Responde JSON {"name":"...","identified":true/false}.',
      userContent: JSON.stringify({
        imageBase64: imageBuffer.toString('base64'),
        mimeType: 'image/jpeg',
      }),
      temperature: 0.1,
    });

    return this.parseVisionResult(data);
  }

  private parseVisionResult(data: unknown): VisionRecognitionResult {
    if (!data || typeof data !== 'object') {
      throw new AiProviderError('Respuesta de visión inválida.', 'invalid_response');
    }

    const obj = data as { name?: unknown; identified?: unknown; confidence?: unknown };
    const name = typeof obj.name === 'string' ? obj.name.trim() : '';
    const identified =
      typeof obj.identified === 'boolean' ? obj.identified : Boolean(name);
    const confidence =
      typeof obj.confidence === 'number' && Number.isFinite(obj.confidence)
        ? Math.max(0, Math.min(100, Math.round(obj.confidence)))
        : identified
          ? 90
          : 0;

    return {
      name: identified ? name : name || '',
      identified: identified && Boolean(name),
      confidence,
    };
  }

  /** Chat con LIA sobre un medicamento (catálogo local / demo) */
  async chat(medicationName: string, question: string): Promise<string> {
    const med = findMedication(medicationName);
    const q = question.toLowerCase();

    if (!med) {
      return `No tengo información detallada sobre ${medicationName}. Te recomiendo consultar con tu médico o farmacéutico.`;
    }

    if (q.includes('para qué') || q.includes('sirve') || q.includes('qué es')) {
      return `${med.name} ${med.description} Pertenece a la categoría de ${med.category}.`;
    }

    if (q.includes('cuándo') || q.includes('hora') || q.includes('tomar')) {
      return `Debes tomar ${med.name} (${med.dose}) según las indicaciones de tu médico. Es importante mantener horarios regulares.`;
    }

    if (q.includes('efecto') || q.includes('secundario') || q.includes('reacción')) {
      return `${med.name} puede causar efectos secundarios leves. Si experimentas algo inusual, contacta a tu médico de inmediato.`;
    }

    if (q.includes('dosis') || q.includes('cuánto') || q.includes('cantidad')) {
      return `La dosis habitual de ${med.name} es ${med.dose}, pero siempre sigue las indicaciones específicas de tu médico.`;
    }

    return `${med.name}: ${med.description} Si tienes dudas específicas, no dudes en consultar a tu médico. Estoy aquí para ayudarte 💙`;
  }

  /**
   * Genera un objeto JSON a partir de instrucciones + contenido de usuario.
   * Usa Gemini (AI_API_KEY + AI_SERVICE_URL base opcional) o un endpoint custom.
   */
  async generateJson(params: {
    systemInstruction: string;
    userContent: string;
    temperature?: number;
    /** Modelo Gemini específico; por defecto AI_SIMPLIFICATION_MODEL / AI_MODEL. */
    model?: string;
  }): Promise<unknown> {
    if (!this.isConfigured()) {
      throw new AiProviderError('IA no configurada.', 'not_configured');
    }

    // Si AI_SERVICE_URL apunta a Gemini, o solo hay API key → generateContent oficial.
    if (!config.ai.serviceUrl || isGeminiApiBase(config.ai.serviceUrl)) {
      return this.callGeminiJson(params);
    }

    return this.callCustomJsonEndpoint(params);
  }

  /**
   * Genera texto conversacional (multi-turn) con Gemini.
   * history: roles user|assistant (assistant se mapea a model en Gemini).
   */
  async generateChatText(params: {
    systemInstruction: string;
    userContent: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    temperature?: number;
    /** Modelo Gemini específico; por defecto AI_CHAT_MODEL / AI_MODEL. */
    model?: string;
  }): Promise<string> {
    if (!this.isConfigured()) {
      throw new AiProviderError('IA no configurada.', 'not_configured');
    }

    if (!config.ai.serviceUrl || isGeminiApiBase(config.ai.serviceUrl)) {
      return this.callGeminiChatText(params);
    }

    // Endpoint custom: empaquetamos como JSON { message }
    const data = await this.callCustomJsonEndpoint({
      systemInstruction: params.systemInstruction,
      userContent: JSON.stringify({
        history: params.history ?? [],
        message: params.userContent,
      }),
      temperature: params.temperature ?? 0.3,
    });

    if (typeof data === 'string') return data.trim();
    if (data && typeof data === 'object' && 'message' in data) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) return message.trim();
    }
    throw new AiProviderError('Respuesta de chat inválida.', 'invalid_response');
  }

  private resolveGeminiModel(requested?: string, fallback?: string): string {
    const model = (requested || fallback || config.ai.model || 'gemini-3.6-flash').trim();
    return model;
  }

  private async callGeminiChatText(params: {
    systemInstruction: string;
    userContent: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    temperature?: number;
    model?: string;
  }): Promise<string> {
    const primaryModel = this.resolveGeminiModel(params.model, config.ai.chatModel);
    const fallbackModel = this.resolveGeminiModel(undefined, config.ai.chatFallbackModel);

    try {
      return await this.callGeminiChatTextWithRetries(params, primaryModel);
    } catch (error) {
      const canFallback =
        error instanceof AiProviderError &&
        isTransientGeminiHttp(error.httpStatus) &&
        fallbackModel !== primaryModel;

      if (!canFallback) {
        throw error;
      }

      console.warn(`[gemini] fallback activated model=${fallbackModel}`);
      return this.callGeminiChatTextWithRetries(params, fallbackModel);
    }
  }

  private async callGeminiChatTextWithRetries(
    params: {
      systemInstruction: string;
      userContent: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      temperature?: number;
    },
    model: string
  ): Promise<string> {
    const maxAttempts = 1 + MAX_GEMINI_RETRIES;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[gemini] model=${model} attempt=${attempt}`);
        return await this.callGeminiChatTextOnce(params, model);
      } catch (error) {
        lastError = error;
        const httpStatus = error instanceof AiProviderError ? error.httpStatus : undefined;
        const retryable =
          error instanceof AiProviderError &&
          isTransientGeminiHttp(httpStatus) &&
          attempt < maxAttempts;

        if (!retryable) {
          throw error;
        }

        const delayMs = geminiRetryDelayMs(attempt);
        console.warn(
          `[gemini] transient model=${model} attempt=${attempt} http=${httpStatus} retryInMs=${delayMs}`
        );
        await sleep(delayMs);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new AiProviderError('No se pudo contactar el proveedor de IA.', 'network');
  }

  private async callGeminiChatTextOnce(
    params: {
      systemInstruction: string;
      userContent: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      temperature?: number;
    },
    model: string
  ): Promise<string> {
    const apiKey = config.ai.apiKey?.trim();
    if (!apiKey) {
      throw new AiProviderError('IA no configurada (falta AI_API_KEY).', 'not_configured');
    }

    const { url, baseUrl } = this.buildGeminiGenerateUrl(model);

    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    for (const turn of params.history ?? []) {
      const text = turn.content.trim();
      if (!text) continue;
      contents.push({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text }],
      });
    }
    contents.push({
      role: 'user',
      parts: [{ text: params.userContent }],
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: params.systemInstruction }],
          },
          contents,
          generationConfig: {
            temperature: params.temperature ?? 0.3,
            maxOutputTokens: 700,
          },
        }),
      });

      const rawText = await response.text();
      let parsedBody: unknown = null;
      try {
        parsedBody = rawText ? JSON.parse(rawText) : null;
      } catch {
        parsedBody = null;
      }

      if (!response.ok) {
        this.logGeminiHttpError({
          status: response.status,
          statusText: response.statusText,
          model,
          baseUrl,
          body: parsedBody,
        });

        const googleMessage =
          parsedBody &&
          typeof parsedBody === 'object' &&
          (parsedBody as GeminiGenerateResponse).error?.message
            ? String((parsedBody as GeminiGenerateResponse).error?.message)
            : `Error HTTP ${response.status} del proveedor de IA.`;

        throw new AiProviderError(googleMessage, 'http', response.status);
      }

      const data = (parsedBody || {}) as GeminiGenerateResponse;
      const text = extractGeminiVisibleText(data);

      if (!text) {
        throw new AiProviderError('La IA no devolvió contenido.', 'invalid_response');
      }

      return text;
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AiProviderError('Timeout del proveedor de IA.', 'timeout');
      }
      throw new AiProviderError('No se pudo contactar el proveedor de IA.', 'network');
    } finally {
      clearTimeout(timer);
    }
  }

  private buildGeminiGenerateUrl(model: string): { url: string; baseUrl: string } {
    const baseUrl = normalizeGeminiBaseUrl(config.ai.serviceUrl);
    // Evitar duplicar /models o /v1beta
    const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`;
    return { url, baseUrl };
  }

  private logGeminiHttpError(params: {
    status: number;
    statusText: string;
    model: string;
    baseUrl: string;
    body: unknown;
  }) {
    if (!isDev()) return;

    const err =
      params.body && typeof params.body === 'object'
        ? (params.body as { error?: { code?: unknown; status?: unknown; message?: unknown } }).error
        : undefined;

    console.error(`[gemini] HTTP=${params.status}`);
    console.error(`[gemini] statusText=${params.statusText}`);
    console.error(`[gemini] model=${params.model}`);
    console.error(`[gemini] baseUrl=${params.baseUrl}`);
    if (err?.code !== undefined) console.error(`[gemini] errorCode=${String(err.code)}`);
    if (err?.status !== undefined) console.error(`[gemini] errorStatus=${String(err.status)}`);
    if (err?.message !== undefined) {
      console.error(`[gemini] message=${String(err.message)}`);
    }

    if (params.status === 400) {
      console.error('[gemini] hint=request/body incorrecto');
    } else if (params.status === 401 || params.status === 403) {
      console.error('[gemini] hint=autenticación/permisos');
    } else if (params.status === 404) {
      console.error('[gemini] hint=modelo/endpoint incorrecto');
    } else if (params.status === 429) {
      console.error('[gemini] hint=cuota/rate limit');
    } else if (params.status >= 500) {
      console.error('[gemini] hint=error externo de Google');
    }
  }

  private async callGeminiJson(params: {
    systemInstruction: string;
    userContent: string;
    temperature?: number;
    model?: string;
  }): Promise<unknown> {
    const apiKey = config.ai.apiKey?.trim();
    if (!apiKey) {
      throw new AiProviderError('IA no configurada (falta AI_API_KEY).', 'not_configured');
    }

    const model = this.resolveGeminiModel(params.model, config.ai.simplificationModel);
    const { url, baseUrl } = this.buildGeminiGenerateUrl(model);
    if (isDev()) {
      console.log(`[gemini] model=${model}`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: params.systemInstruction }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: params.userContent }],
            },
          ],
          generationConfig: {
            temperature: params.temperature ?? 0.2,
            responseMimeType: 'application/json',
          },
        }),
      });

      const rawText = await response.text();
      let parsedBody: unknown = null;
      try {
        parsedBody = rawText ? JSON.parse(rawText) : null;
      } catch {
        parsedBody = null;
      }

      if (!response.ok) {
        this.logGeminiHttpError({
          status: response.status,
          statusText: response.statusText,
          model,
          baseUrl,
          body: parsedBody,
        });

        const googleMessage =
          parsedBody &&
          typeof parsedBody === 'object' &&
          (parsedBody as GeminiGenerateResponse).error?.message
            ? String((parsedBody as GeminiGenerateResponse).error?.message)
            : `Error HTTP ${response.status} del proveedor de IA.`;

        throw new AiProviderError(googleMessage, 'http', response.status);
      }

      const data = (parsedBody || {}) as GeminiGenerateResponse;
      if (data.error?.message) {
        this.logGeminiHttpError({
          status: 400,
          statusText: 'API Error',
          model,
          baseUrl,
          body: data,
        });
        throw new AiProviderError(data.error.message, 'http', 400);
      }

      const text = data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
        .trim();

      if (!text) {
        throw new AiProviderError('La IA no devolvió contenido.', 'invalid_response');
      }

      return this.parseJsonLoose(text);
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AiProviderError('Timeout del proveedor de IA.', 'timeout');
      }
      throw new AiProviderError('No se pudo contactar el proveedor de IA.', 'network');
    } finally {
      clearTimeout(timer);
    }
  }

  private async callCustomJsonEndpoint(params: {
    systemInstruction: string;
    userContent: string;
    temperature?: number;
  }): Promise<unknown> {
    const endpoint = config.ai.serviceUrl;
    if (!endpoint) {
      throw new AiProviderError('IA no configurada.', 'not_configured');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (config.ai.apiKey) {
        headers.Authorization = `Bearer ${config.ai.apiKey}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers,
        body: JSON.stringify({
          systemInstruction: params.systemInstruction,
          content: params.userContent,
          temperature: params.temperature ?? 0.2,
          responseFormat: 'json',
        }),
      });

      if (!response.ok) {
        if (isDev()) {
          console.error(`[ai-custom] HTTP=${response.status} statusText=${response.statusText}`);
        }
        throw new AiProviderError(
          `Error HTTP ${response.status} del servicio de IA.`,
          'http',
          response.status
        );
      }

      const data = (await response.json()) as unknown;
      if (data && typeof data === 'object' && 'content' in data) {
        const content = (data as { content?: unknown }).content;
        if (typeof content === 'string') return this.parseJsonLoose(content);
        return content;
      }
      return data;
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AiProviderError('Timeout del proveedor de IA.', 'timeout');
      }
      throw new AiProviderError('No se pudo contactar el servicio de IA.', 'network');
    } finally {
      clearTimeout(timer);
    }
  }

  private parseJsonLoose(text: string): unknown {
    const trimmed = text.trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      const match = trimmed.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new AiProviderError('JSON inválido de la IA.', 'invalid_response');
      }
      try {
        return JSON.parse(match[0]);
      } catch {
        throw new AiProviderError('JSON inválido de la IA.', 'invalid_response');
      }
    }
  }
}

export const aiService = new AIService();
