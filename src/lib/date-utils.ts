import { parseISO, format as dateFnsFormat, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Safely parses a date string (YYYY-MM-DD) to a Date object
 * Uses parseISO which properly handles date-only strings without timezone issues
 */
export const parseLocalDate = (dateString: string): Date => {
  // parseISO handles YYYY-MM-DD correctly as local time
  return parseISO(dateString);
};

/**
 * Formats a date string (YYYY-MM-DD) to Brazilian format (DD/MM/YYYY)
 * Avoids timezone issues by using parseISO
 */
export const formatLocalDate = (dateString: string, formatStr: string = 'dd/MM/yyyy'): string => {
  if (!dateString) return '-';
  const date = parseISO(dateString);
  return dateFnsFormat(date, formatStr, { locale: ptBR });
};

/**
 * Gets today's date at midnight for comparison purposes
 */
export const getTodayMidnight = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

/**
 * Formats a Date object as a YYYY-MM-DD string in the LOCAL timezone.
 *
 * Use this instead of `someDate.toISOString().split('T')[0]` — `toISOString()`
 * converts to UTC, which in BRT (UTC-3) rolls over to the next day after 21:00
 * local time, gravando datas um dia adiantadas.
 */
export const formatDateLocalISO = (date: Date): string => dateFnsFormat(date, 'yyyy-MM-dd');

/**
 * Returns today's date in the local timezone as a YYYY-MM-DD string.
 */
export const todayLocalISO = (): string => formatDateLocalISO(new Date());

/**
 * Returns today's date offset by `days`, in the local timezone, as YYYY-MM-DD.
 * Same timezone-safety rationale as `formatDateLocalISO`.
 */
export const addDaysLocalISO = (days: number): string => formatDateLocalISO(addDays(new Date(), days));

/**
 * Compares a date string with today to check if it's overdue
 */
export const isOverdue = (dateString: string): boolean => {
  const date = parseISO(dateString);
  date.setHours(0, 0, 0, 0);
  const today = getTodayMidnight();
  return date < today;
};
