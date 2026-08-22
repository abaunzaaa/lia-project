import { deriveDoseStatus, fetchScheduledDoses } from './scheduledDoseService';
import { ScheduledDoseRow } from '../models/intakeTypes';
import {
  HistoryInsightsDailyItem,
  HistoryInsightsMedicationItem,
  HistoryInsightsResponse,
  HistoryInsightsSummary,
  HistoryInsightsTimeOfDayItem,
  InsightsCountBucket,
  TimeOfDayPeriod,
} from '../models/historyInsightsTypes';
import { eachDateInclusive, hourFromTimeHm, minDate, todayInTimeZone } from '../utils/timezone';

function emptyBucket(): InsightsCountBucket {
  return {
    totalDue: 0,
    taken: 0,
    skipped: 0,
    missed: 0,
    adherencePercentage: null,
  };
}

function finalizeBucket(bucket: InsightsCountBucket): InsightsCountBucket {
  const totalDue = bucket.taken + bucket.skipped + bucket.missed;
  return {
    totalDue,
    taken: bucket.taken,
    skipped: bucket.skipped,
    missed: bucket.missed,
    adherencePercentage: totalDue === 0 ? null : Math.round((bucket.taken / totalDue) * 100),
  };
}

function addStatus(bucket: InsightsCountBucket, status: 'taken' | 'skipped' | 'missed') {
  if (status === 'taken') bucket.taken += 1;
  else if (status === 'skipped') bucket.skipped += 1;
  else bucket.missed += 1;
}

export function classifyTimeOfDay(timeHm: string): TimeOfDayPeriod {
  const hour = hourFromTimeHm(timeHm);
  if (hour >= 5 && hour <= 11) return 'morning';
  if (hour >= 12 && hour <= 17) return 'afternoon';
  return 'evening';
}

/**
 * Agrega dosis vencidas (scheduled_for <= now). Pending no cuenta.
 */
export function buildInsightsFromRows(params: {
  rows: ScheduledDoseRow[];
  from: string;
  to: string;
  timezone: string;
  now?: Date;
}): HistoryInsightsResponse {
  const now = params.now ?? new Date();
  const dueRows = params.rows.filter((row) => row.scheduled_for.getTime() <= now.getTime());

  const summaryAcc = emptyBucket();
  const dailyMap = new Map<string, InsightsCountBucket>();
  for (const date of eachDateInclusive(params.from, params.to)) {
    dailyMap.set(date, emptyBucket());
  }

  const medMap = new Map<
    string,
    { name: string; bucket: InsightsCountBucket }
  >();

  const periodMap: Record<TimeOfDayPeriod, InsightsCountBucket> = {
    morning: emptyBucket(),
    afternoon: emptyBucket(),
    evening: emptyBucket(),
  };

  for (const row of dueRows) {
    const status = deriveDoseStatus(row.scheduled_for, row.intake_status, now);
    if (status === 'pending') continue;
    if (status !== 'taken' && status !== 'skipped' && status !== 'missed') continue;

    addStatus(summaryAcc, status);

    const dayBucket = dailyMap.get(row.dose_date) ?? emptyBucket();
    addStatus(dayBucket, status);
    dailyMap.set(row.dose_date, dayBucket);

    const med = medMap.get(row.medication_id) ?? {
      name: row.medication_name,
      bucket: emptyBucket(),
    };
    addStatus(med.bucket, status);
    medMap.set(row.medication_id, med);

    const period = classifyTimeOfDay(row.time_hm);
    addStatus(periodMap[period], status);
  }

  const summary: HistoryInsightsSummary = finalizeBucket(summaryAcc);

  const daily: HistoryInsightsDailyItem[] = eachDateInclusive(params.from, params.to).map(
    (date) => ({
      date,
      ...finalizeBucket(dailyMap.get(date) ?? emptyBucket()),
    })
  );

  const byMedication: HistoryInsightsMedicationItem[] = Array.from(medMap.entries())
    .map(([medicationId, value]) => ({
      medicationId,
      name: value.name,
      ...finalizeBucket(value.bucket),
    }))
    .sort((a, b) => {
      const attentionA = a.missed + a.skipped;
      const attentionB = b.missed + b.skipped;
      if (attentionA !== attentionB) return attentionB - attentionA;
      const adhA = a.adherencePercentage ?? 101;
      const adhB = b.adherencePercentage ?? 101;
      if (adhA !== adhB) return adhA - adhB;
      return a.name.localeCompare(b.name, 'es');
    });

  const byTimeOfDay: HistoryInsightsTimeOfDayItem[] = (
    ['morning', 'afternoon', 'evening'] as TimeOfDayPeriod[]
  ).map((period) => ({
    period,
    ...finalizeBucket(periodMap[period]),
  }));

  const insights = buildDeterministicInsights({
    summary,
    byMedication,
    byTimeOfDay,
  });

  return {
    range: {
      from: params.from,
      to: params.to,
      timezone: params.timezone,
    },
    summary,
    daily,
    byMedication,
    byTimeOfDay,
    insights,
  };
}

function buildDeterministicInsights(params: {
  summary: HistoryInsightsSummary;
  byMedication: HistoryInsightsMedicationItem[];
  byTimeOfDay: HistoryInsightsTimeOfDayItem[];
}): string[] {
  const { summary, byMedication, byTimeOfDay } = params;
  const insights: string[] = [];

  if (summary.totalDue === 0) {
    return [];
  }

  // 1) Visión general
  if (summary.adherencePercentage !== null) {
    if (summary.adherencePercentage >= 90) {
      insights.push('Registraste la mayoría de tus tomas programadas en este período.');
    } else if (summary.adherencePercentage >= 70) {
      insights.push('Algunas tomas quedaron omitidas o sin registrar en este período.');
    } else {
      insights.push('Hay varias tomas que quedaron omitidas o sin registrar.');
    }
  }

  // 2) Patrón por momento del día (solo si hay diferencia clara)
  const periodInsight = pickTimeOfDayInsight(byTimeOfDay, summary.totalDue);
  if (periodInsight) insights.push(periodInsight);

  // 3) Medicamento con más atención / skipped
  if (insights.length < 3) {
    const medInsight = pickMedicationInsight(byMedication);
    if (medInsight) insights.push(medInsight);
  }

  // Skipped insight if room and not redundant
  if (insights.length < 3) {
    if (summary.skipped === 0) {
      insights.push('En este período no registraste tomas como omitidas.');
    } else if (summary.skipped > 0) {
      const label = summary.skipped === 1 ? 'toma' : 'tomas';
      const omitted = summary.skipped === 1 ? 'omitida' : 'omitidas';
      insights.push(`Registraste ${summary.skipped} ${label} como ${omitted}.`);
    }
  }

  return insights.slice(0, 3);
}

function pickTimeOfDayInsight(
  byTimeOfDay: HistoryInsightsTimeOfDayItem[],
  totalDue: number
): string | null {
  if (totalDue < 3) return null;

  const ranked = [...byTimeOfDay].sort((a, b) => b.missed - a.missed);
  const top = ranked[0];
  const second = ranked[1];
  if (!top || top.missed < 2) return null;
  if (second && top.missed - second.missed < 1) return null;
  // Debe concentrar claramente más missed que el resto
  const othersMissed = ranked.slice(1).reduce((sum, item) => sum + item.missed, 0);
  if (top.missed <= othersMissed) return null;

  if (top.period === 'morning') return 'La mañana concentró más tomas sin registrar.';
  if (top.period === 'afternoon') return 'La tarde concentró más tomas sin registrar.';
  return 'La noche concentró más tomas sin registrar.';
}

function pickMedicationInsight(byMedication: HistoryInsightsMedicationItem[]): string | null {
  const candidate = byMedication.find((item) => item.missed >= 2);
  if (!candidate) return null;
  const label = candidate.missed === 1 ? 'toma' : 'tomas';
  return `${candidate.name} tuvo ${candidate.missed} ${label} sin registrar en este período.`;
}

/**
 * Insights de historial para un usuario.
 * Reutiliza fetchScheduledDoses (historical): start/end date + archived_at.
 */
export async function getHistoryInsights(params: {
  userId: string;
  from: string;
  to: string;
  timezone: string;
}): Promise<HistoryInsightsResponse> {
  const today = todayInTimeZone(params.timezone);
  const fetchTo = minDate(params.to, today);

  let rows: ScheduledDoseRow[] = [];
  if (fetchTo >= params.from) {
    rows = await fetchScheduledDoses({
      userId: params.userId,
      from: params.from,
      to: fetchTo,
      timezone: params.timezone,
      mode: 'historical',
    });
  }

  return buildInsightsFromRows({
    rows,
    from: params.from,
    to: params.to,
    timezone: params.timezone,
  });
}
