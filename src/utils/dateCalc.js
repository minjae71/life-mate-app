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

// ISO 문자열 → "YYYY-MM-DD (요일)" (날짜 문자열용 편의)
export function isoLabelWithDow(iso) {
  return labelWithDow(parseISO(iso));
}

// 오늘(로컬 자정) Date
export function todayDate() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

// 기념일 D-day 정보.
// repeat=false: 등록일 기준. 지난 날은 D+N(오늘이 N+1일째), 미래는 D-N, 당일 D-DAY.
// repeat=true : 매년 돌아오는 "다음" 기념일까지 D-N, 당일이면 D-DAY. 몇 주년인지 함께 표시.
// 반환 { main, sub, dir }  dir: 'past' | 'future' | 'day'
export function ddayInfo(iso, repeat) {
  const target = parseISO(iso);
  if (!target) return null;
  const today = todayDate();

  if (repeat) {
    const y = today.getFullYear();
    let next = new Date(y, target.getMonth(), target.getDate());
    if (next < today) next = new Date(y + 1, target.getMonth(), target.getDate());
    const remain = Math.round((next - today) / MS_PER_DAY);
    const anniv = next.getFullYear() - target.getFullYear();
    const annivLabel = anniv >= 1 ? `${anniv}주년` : '';
    if (remain === 0) {
      return { main: 'D-DAY', sub: annivLabel ? `${annivLabel} 🎉` : '오늘 🎉', dir: 'day' };
    }
    return { main: `D-${remain}`, sub: annivLabel ? `${annivLabel}까지` : null, dir: 'future' };
  }

  const diff = Math.round((today - target) / MS_PER_DAY);
  if (diff === 0) return { main: 'D-DAY', sub: '오늘', dir: 'day' };
  if (diff > 0) return { main: `D+${diff}`, sub: `${diff + 1}일째`, dir: 'past' };
  return { main: `D-${-diff}`, sub: null, dir: 'future' };
}
