export type TimeOfDayPeriod = 'morning' | 'afternoon' | 'evening';

export interface InsightsCountBucket {
  totalDue: number;
  taken: number;
  skipped: number;
  missed: number;
  adherencePercentage: number | null;
}

export interface HistoryInsightsSummary extends InsightsCountBucket {}

export interface HistoryInsightsDailyItem extends InsightsCountBucket {
  date: string;
}

export interface HistoryInsightsMedicationItem extends InsightsCountBucket {
  medicationId: string;
  name: string;
}

export interface HistoryInsightsTimeOfDayItem extends InsightsCountBucket {
  period: TimeOfDayPeriod;
}

export interface HistoryInsightsResponse {
  range: {
    from: string;
    to: string;
    timezone: string;
  };
  summary: HistoryInsightsSummary;
  daily: HistoryInsightsDailyItem[];
  byMedication: HistoryInsightsMedicationItem[];
  byTimeOfDay: HistoryInsightsTimeOfDayItem[];
  insights: string[];
}
