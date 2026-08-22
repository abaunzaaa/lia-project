import { apiRequest, authHeaders, ApiClientError } from './apiClient';

export type IntakeStatus = 'taken' | 'skipped';

export type SetIntakePayload = {
  medicationId: string;
  scheduleId: string;
  date: string;
  timezone: string;
  status: IntakeStatus;
};

export type ApiIntake = {
  id: string;
  medicationId: string;
  scheduleId: string | null;
  scheduledFor: string;
  status: IntakeStatus;
  actionAt: string;
};

type IntakeBody = {
  success: boolean;
  message?: string;
  data?: { intake: ApiIntake };
};

/**
 * POST /intakes
 * Body: medicationId, scheduleId, date, timezone, status
 * No envía userId ni scheduledFor.
 */
export async function setIntakeStatus(payload: SetIntakePayload): Promise<ApiIntake> {
  const headers = await authHeaders();
  const response = await apiRequest(
    '/intakes',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        medicationId: payload.medicationId,
        scheduleId: payload.scheduleId,
        date: payload.date,
        timezone: payload.timezone,
        status: payload.status,
      }),
    },
    { notFoundMessage: 'Este recordatorio ya no está disponible.' }
  );

  const body = (await response.json()) as IntakeBody;
  if (!body.data?.intake) {
    throw new ApiClientError('No pudimos completar la acción. Inténtalo nuevamente.');
  }
  return body.data.intake;
}

export { ApiClientError as IntakeApiError };
