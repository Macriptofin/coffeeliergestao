import { parseISO, format as dateFnsFormat } from 'date-fns';
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
 * Compares a date string with today to check if it's overdue
 */
export const isOverdue = (dateString: string): boolean => {
  const date = parseISO(dateString);
  date.setHours(0, 0, 0, 0);
  const today = getTodayMidnight();
  return date < today;
};
