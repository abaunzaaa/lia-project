import { DoseStatus, HistoryEntry } from '../types';
import { apiRequest, authHeaders, ApiClientError } from './apiClient';

export type ApiHistoryItem = {
  medicationId: string;
  scheduleId: string;
  intakeId: string | null;
  medication: { name: string; dose: string };
  date: string;
  time: string;
  scheduledFor: string;
  status: DoseStatus;
  actionAt: string | null;
};

type ListBody = {
  success: boolean;
  data?: ApiHistoryItem[];
  message?: string;
};

export function mapApiHistoryItem(item: ApiHistoryItem): HistoryEntry {
  return {
    id: `${item.medicationId}-${item.scheduleId}-${item.date}-${item.time}`,
    medicationId: item.medicationId,
    scheduleId: item.scheduleId,
    medicationName: item.medication?.name ?? '',
    dose: item.medication?.dose ?? '',
    date: item.date,
    time: item.time,
    scheduledFor: item.scheduledFor,
    status: item.status,
    actionAt: item.actionAt,
  };
}

/**
 * GET /history?from=&to=&timezone=
 */
export async function getHistory(
  from: string,
  to: string,
  timezone: string
): Promise<HistoryEntry[]> {
  const headers = await authHeaders();
  const qs = new URLSearchParams({ from, to, timezone });
  const response = await apiRequest(`/history?${qs.toString()}`, {
    method: 'GET',
    headers,
  });

  const body = (await response.json()) as ListBody;
  const list = Array.isArray(body.data) ? body.data : [];
  return list.map(mapApiHistoryItem);
}

export { ApiClientError as HistoryApiError };
