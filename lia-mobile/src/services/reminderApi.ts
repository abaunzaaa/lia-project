import { DoseStatus, Reminder } from '../types';
import { apiRequest, authHeaders, ApiClientError } from './apiClient';

export type ApiReminderItem = {
  id: string;
  medicationId: string;
  scheduleId: string;
  medication: { name: string; dose: string };
  date: string;
  time: string;
  scheduledFor: string;
  status: DoseStatus;
  intakeId: string | null;
  actionAt: string | null;
};

type ListBody = {
  success: boolean;
  data?: ApiReminderItem[];
  message?: string;
};

export function mapApiReminder(item: ApiReminderItem): Reminder {
  return {
    id: item.id,
    medicationId: item.medicationId,
    scheduleId: item.scheduleId,
    medicationName: item.medication?.name ?? '',
    dose: item.medication?.dose ?? '',
    scheduledTime: item.time,
    date: item.date,
    scheduledFor: item.scheduledFor,
    status: item.status,
    intakeId: item.intakeId,
    actionAt: item.actionAt,
  };
}

/**
 * GET /reminders?date=YYYY-MM-DD&timezone=...
 */
export async function getReminders(date: string, timezone: string): Promise<Reminder[]> {
  const headers = await authHeaders();
  const qs = new URLSearchParams({ date, timezone });
  const response = await apiRequest(`/reminders?${qs.toString()}`, {
    method: 'GET',
    headers,
  });

  const body = (await response.json()) as ListBody;
  const list = Array.isArray(body.data) ? body.data : [];
  return list.map(mapApiReminder);
}

export { ApiClientError as ReminderApiError };
