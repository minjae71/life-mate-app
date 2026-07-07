// 근무시간 계산 로직 (초 단위)
// -----------------------------------------------------------------------------
// 월 단위 정산. 주말/공휴일을 제외한 근무일 × 8시간이 이번 달 필요 근무시간입니다.
// 시각은 24시간제 "HH:MM" 또는 "HH:MM:SS" 문자열로 저장됩니다.

export const WORK_SECONDS_PER_DAY = 8 * 3600; // 하루 8시간

// 요일 이름 (일=0 ~ 토=6). 여러 화면에서 공용으로 씁니다.
export const DOW_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export function pad(n) {
  return String(n).padStart(2, '0');
}

export function toISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// "HH:MM" | "HH:MM:SS" -> 자정 기준 초. 형식이 잘못되면 null.
export function parseTime(str) {
  if (!str) return null;
  const [h, m, s = 0] = str.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m) || Number.isNaN(s)) return null;
  return h * 3600 + m * 60 + s;
}

// 한 달의 모든 날짜 정보 배열. holidays: { 'YYYY-MM-DD': '이름' }
export function getMonthDays(year, monthIndex, holidays = {}) {
  const days = [];
  const count = new Date(year, monthIndex + 1, 0).getDate();
  for (let d = 1; d <= count; d++) {
    const date = new Date(year, monthIndex, d);
    const iso = toISO(date);
    const dow = date.getDay(); // 0=일 ~ 6=토
    const isWeekend = dow === 0 || dow === 6;
    const holidayName = holidays[iso] || null;
    days.push({
      iso,
      day: d,
      dow,
      dowName: DOW_NAMES[dow],
      isWeekend,
      holidayName,
      isWorkday: !isWeekend && !holidayName,
    });
  }
  return days;
}

// 하루 근무시간(초). 연차면 8시간 고정. 값이 불완전하면 null.
export function workedSeconds(entry, breakMinutes) {
  if (!entry) return null;
  if (entry.leave) return WORK_SECONDS_PER_DAY; // 연차: 8시간 자동 반영
  const start = parseTime(entry.start);
  const end = parseTime(entry.end);
  if (start == null || end == null) return null;
  const gross = end - start;
  if (gross <= 0) return 0;
  return Math.max(0, gross - breakMinutes * 60);
}

function hasEntry(entry) {
  return !!(entry && (entry.leave || (entry.start && entry.end)));
}

/**
 * 월 정산 요약(초 단위).
 * @param {Array} days - getMonthDays 결과
 * @param {Object} entries - { 'YYYY-MM-DD': {start,end} | {leave:true} }
 * @param {number} breakMinutes - 하루 휴게시간(분)
 * @param {string} todayISO - 오늘 날짜(YYYY-MM-DD)
 */
export function computeSummary(days, entries, breakMinutes, todayISO) {
  const workdays = days.filter((d) => d.isWorkday);
  const requiredSeconds = workdays.length * WORK_SECONDS_PER_DAY;

  let workedTotal = 0;
  for (const d of days) {
    workedTotal += workedSeconds(entries[d.iso], breakMinutes) || 0;
  }

  const remainingSeconds = requiredSeconds - workedTotal;

  const remainingWorkdayCount = workdays.filter(
    (d) => d.iso >= todayISO && !hasEntry(entries[d.iso])
  ).length;

  const avgPerDay =
    remainingWorkdayCount > 0 ? remainingSeconds / remainingWorkdayCount : null;

  return {
    workdayCount: workdays.length,
    requiredSeconds,
    workedTotal,
    remainingSeconds,
    remainingWorkdayCount,
    avgPerDay,
  };
}

// 초 -> "N시간 M분 S초" (0인 단위는 생략, 음수는 앞에 -)
export function fmtDuration(seconds) {
  if (seconds == null) return '-';
  const sign = seconds < 0 ? '-' : '';
  let abs = Math.abs(Math.round(seconds));
  const h = Math.floor(abs / 3600);
  abs %= 3600;
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const parts = [];
  if (h) parts.push(`${h}시간`);
  if (m) parts.push(`${m}분`);
  if (s) parts.push(`${s}초`);
  if (parts.length === 0) parts.push('0분');
  return sign + parts.join(' ');
}
