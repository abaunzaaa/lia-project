import { AdherenceSummary } from '../types';
import { apiRequest, authHeaders, ApiClientError } from './apiClient';

type AdherenceBody = {
  success: boolean;
  data?: AdherenceSummary;
  message?: string;
};

/**
 * GET /adherence?from=&to=&timezone=
 */
export async function getAdherence(
  from: string,
  to: string,
  timezone: string
): Promise<AdherenceSummary> {
  const headers = await authHeaders();
  const qs = new URLSearchParams({ from, to, timezone });
  const response = await apiRequest(`/adherence?${qs.toString()}`, {
    method: 'GET',
    headers,
  });

  const body = (await response.json()) as AdherenceBody;
  if (!body.data) {
    return {
      totalScheduled: 0,
      taken: 0,
      skipped: 0,
      missed: 0,
      percentage: null,
    };
  }

  return {
    totalScheduled: body.data.totalScheduled ?? 0,
    taken: body.data.taken ?? 0,
    skipped: body.data.skipped ?? 0,
    missed: body.data.missed ?? 0,
    percentage: body.data.percentage ?? null,
  };
}

export { ApiClientError as AdherenceApiError };
