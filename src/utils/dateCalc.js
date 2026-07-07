// 날짜 계산 로직 (네이버 날짜 계산기 방식)
import { DOW_NAMES, toISO } from './workHours.js';

export { DOW_NAMES, toISO };

const MS_PER_DAY = 86400000;

// "YYYY-MM-DD" → 로컬 자정 Date
export function parseISO(iso) {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// 두 날짜 사이 일수 (종료 − 시작). 음수 가능.
export function diffDays(startISO, endISO) {
  const a = parseISO(startISO);
  const b = parseISO(endISO);
  if (!a || !b) return null;
  return Math.round((b - a) / MS_PER_DAY);
}

// 기준일에 amount(unit) 더하기(음수면 빼기) → Date. unit: 'day'|'week'|'month'|'year'
export function addToDate(iso, amount, unit) {
  const d = parseISO(iso);
  if (!d) return null;
  const n = Math.trunc(Number(amount) || 0);
  if (unit === 'week') d.setDate(d.getDate() + n * 7);
  else if (unit === 'month') d.setMonth(d.getMonth() + n);
  else if (unit === 'year') d.setFullYear(d.getFullYear() + n);
  else d.setDate(d.getDate() + n);
  return d;
}

// Date → "YYYY-MM-DD (요일)"
export function labelWithDow(date) {
  if (!date) return '-';
  return `${toISO(date)} (${DOW_NAMES[date.getDay()]})`;
}
