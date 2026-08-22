import { fetchScheduledDoses, toReminderItem } from './scheduledDoseService';
import { ReminderItem } from '../models/intakeTypes';

export async function getRemindersForDay(params: {
  userId: string;
  date: string;
  timezone: string;
}): Promise<ReminderItem[]> {
  const rows = await fetchScheduledDoses({
    userId: params.userId,
    from: params.date,
    to: params.date,
    timezone: params.timezone,
    mode: 'active_only',
  });

  const now = new Date();
  return rows
    .map((row) => toReminderItem(row, now))
    .sort((a, b) => a.time.localeCompare(b.time));
}
