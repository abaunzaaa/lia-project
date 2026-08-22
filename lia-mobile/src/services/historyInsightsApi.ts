import {
  HistoryInsightsData,
  HistoryInsightsDaily,
  HistoryInsightsMedication,
  HistoryInsightsSummary,
  HistoryInsightsTimeOfDay,
} from '../types';
import { apiRequest, authHeaders, ApiClientError } from './apiClient';

type InsightsBody = {
  success: boolean;
  data?: HistoryInsightsData;
  message?: string;
};

function mapBucket(raw: Partial<HistoryInsightsSummary> | undefined): HistoryInsightsSummary {
  return {
    totalDue: raw?.totalDue ?? 0,
    taken: raw?.taken ?? 0,
    skipped: raw?.skipped ?? 0,
    missed: raw?.missed ?? 0,
    adherencePercentage:
      raw?.adherencePercentage === undefined ? null : raw.adherencePercentage,
  };
}

/**
 * GET /history/insights?from=&to=&timezone=
 */
export async function getHistoryInsights(params: {
  from: string;
  to: string;
  timezone: string;
}): Promise<HistoryInsightsData> {
  const headers = await authHeaders();
  const qs = new URLSearchParams({
    from: params.from,
    to: params.to,
    timezone: params.timezone,
  });

  const response = await apiRequest(`/history/insights?${qs.toString()}`, {
    method: 'GET',
    headers,
  });

  const body = (await response.json()) as InsightsBody;
  if (!body.data) {
    throw new ApiClientError('No pudimos cargar el resumen en este momento.', 502);
  }

  const data = body.data;
  const daily: HistoryInsightsDaily[] = Array.isArray(data.daily)
    ? data.daily.map((d) => ({
        date: d.date,
        ...mapBucket(d),
      }))
    : [];

  const byMedication: HistoryInsightsMedication[] = Array.isArray(data.byMedication)
    ? data.byMedication.map((m) => ({
        medicationId: m.medicationId,
        name: m.name,
        ...mapBucket(m),
      }))
    : [];

  const byTimeOfDay: HistoryInsightsTimeOfDay[] = Array.isArray(data.byTimeOfDay)
    ? data.byTimeOfDay.map((t) => ({
        period: t.period,
        ...mapBucket(t),
      }))
    : [];

  return {
    range: {
      from: data.range?.from ?? params.from,
      to: data.range?.to ?? params.to,
      timezone: data.range?.timezone ?? params.timezone,
    },
    summary: mapBucket(data.summary),
    daily,
    byMedication,
    byTimeOfDay,
    insights: Array.isArray(data.insights) ? data.insights.filter(Boolean) : [],
  };
}

export { ApiClientError as HistoryInsightsApiError };
