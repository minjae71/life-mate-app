// 운동 기록 로직 (달력 저장)
// -----------------------------------------------------------------------------
// 상체/하체를 번갈아 진행. 날짜별로 종목과 체크 상태를 기록합니다.
// 어떤 날의 추천 종목 = 직전 기록일이 완료면 반대 부위, 미완료면 같은 부위.

import { toISO } from './workHours.js';

export { toISO };

export const PLAN_KEY = 'workout:plan';
export const LOG_KEY = 'workout:log';
export const LABEL = { upper: '상체', lower: '하체' };
export const SHORT = { upper: '상', lower: '하' };
export const ICON = { upper: '💪', lower: '🦵' };

export function flip(type) {
  return type === 'upper' ? 'lower' : 'upper';
}

export const DEFAULT_PLAN = {
  upper: [
    { id: 'u1', text: '푸시업' },
    { id: 'u2', text: '숄더프레스' },
    { id: 'u3', text: '덤벨컬' },
    { id: 'u4', text: '풀업' },
  ],
  lower: [
    { id: 'l1', text: '스쿼트' },
    { id: 'l2', text: '런지' },
    { id: 'l3', text: '레그컬' },
    { id: 'l4', text: '카프레이즈' },
  ],
};

export function loadPlan() {
  try {
    const p = JSON.parse(localStorage.getItem(PLAN_KEY));
    if (p && p.upper && p.lower) return p;
  } catch {
    /* ignore */
  }
  return DEFAULT_PLAN;
}
export function loadLog() {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY)) || {};
  } catch {
    return {};
  }
}

// 해당 날짜 기록이 "완료"인지.
// 종목이 여러 개면 하나는 빼먹어도(예: 4개 중 3개) 완료로 인정합니다.
export function isDayDone(record, plan) {
  if (!record) return false;
  const list = plan[record.type] || [];
  if (list.length === 0) return false;
  const doneCount = list.filter((e) => record.doneIds.includes(e.id)).length;
  const need = Math.max(1, list.length - 1); // 하나는 쉬어도 OK
  return doneCount >= need;
}

// 지금까지 같은 부위를 기록한 날 수(해당 날짜 이전). 로테이션 회차 계산용.
export function rotationCount(log, iso, type) {
  return Object.keys(log).filter((d) => d < iso && log[d]?.type === type).length;
}

// 이번 회차에 "쉬는(빼는)" 종목의 인덱스. 매 회차마다 마지막→처음으로 이동해
// 결과적으로 4개면 123 → 124 → 134 → 234 순서로 돌아갑니다. -1이면 뺄 것 없음.
export function skipIndex(count, len) {
  if (len <= 1) return -1;
  return len - 1 - (count % len);
}

// 특정 날짜/부위에서 오늘 쉬어도 되는(추천에서 빠지는) 종목 id. 없으면 null.
export function restExerciseId(log, iso, type, plan) {
  const list = plan[type] || [];
  const idx = skipIndex(rotationCount(log, iso, type), list.length);
  return idx >= 0 ? (list[idx]?.id ?? null) : null;
}

// 특정 날짜의 추천 종목: 직전 기록일이 완료면 반대, 미완료면 같은 부위. 없으면 상체.
export function suggestedType(log, iso, plan) {
  const prevDates = Object.keys(log)
    .filter((d) => d < iso)
    .sort();
  if (prevDates.length === 0) return 'upper';
  const last = log[prevDates[prevDates.length - 1]];
  return isDayDone(last, plan) ? flip(last.type) : last.type;
}

// 화면에 표시할 종목: 기록이 있으면 그 종목, 없으면 추천 종목
export function displayType(log, iso, plan) {
  return log[iso]?.type ?? suggestedType(log, iso, plan);
}
