// 운동 기록 로직 (달력 저장)
// -----------------------------------------------------------------------------
// 상체/하체를 번갈아 진행. 날짜별로 종목과 체크 상태를 기록합니다.
// 어떤 날의 추천 종목 = 직전 기록일이 완료면 반대 부위, 미완료면 같은 부위.
// 쉬는 종목 로테이션은 "직전에 완료한 같은 부위 날에 실제로 체크한 종목"을
// 기준으로 이어집니다(날짜 카운트가 아니라 체크 결과 기준).

import { toISO } from './workHours.js';
import { loadJSON } from './storage.js';

export { toISO };

export const PLAN_KEY = 'workout:plan';
export const LOG_KEY = 'workout:log';
export const REST = 'rest';
export const LABEL = { upper: '상체', lower: '하체', rest: '쉬는날' };
export const SHORT = { upper: '상', lower: '하', rest: '휴' };
export const ICON = { upper: '💪', lower: '🦵', rest: '💤' };

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
  const p = loadJSON(PLAN_KEY, null);
  return p && p.upper && p.lower ? p : DEFAULT_PLAN;
}
export function loadLog() {
  return loadJSON(LOG_KEY, {});
}

// 해당 날짜 기록이 "완료"인지.
// 종목이 여러 개면 하나는 빼먹어도(예: 4개 중 3개) 완료로 인정합니다.
export function isDayDone(record, plan) {
  if (!record) return false;
  if (record.type === REST) return true; // 쉬는날은 그 자체로 완료(로테이션엔 영향 없음)
  const list = plan[record.type] || [];
  if (list.length === 0) return false;
  const doneCount = list.filter((e) => record.doneIds.includes(e.id)).length;
  const need = Math.max(1, list.length - 1); // 하나는 쉬어도 OK
  return doneCount >= need;
}

// 완료한 날의 기록에서 실제로 "쉰"(체크 안 한) 종목의 인덱스.
// 정확히 하나만 빠졌으면 그 인덱스, 다 했거나 애매하면 -1.
export function skippedIndexOf(record, plan) {
  const list = plan[record.type] || [];
  if (list.length <= 1) return -1;
  const missing = list
    .map((e, i) => (record.doneIds.includes(e.id) ? -1 : i))
    .filter((i) => i >= 0);
  return missing.length === 1 ? missing[0] : -1;
}

// 이번 회차에 쉬는 종목의 인덱스. 최근 완료한 같은 부위 3회를 분석해
// "가장 많이 한 종목"을 쉽니다 → 덜 한(누락·신규) 종목이 자연히 포함됩니다.
// 동점이면 평소 로테이션 순서(직전에 쉰 것의 다음)를 따르므로, 안정 상태에선
// 4개 기준 123 → 124 → 134 → 234 → 123 으로 그대로 순환합니다. -1이면 뺄 것 없음.
export function skipIndex(log, iso, type, plan) {
  const list = plan[type] || [];
  const len = list.length;
  if (len <= 1) return -1;

  // 최근 완료한 같은 부위 날들(오래된→최신)
  const prevDone = Object.keys(log)
    .filter((d) => d < iso && log[d]?.type === type && isDayDone(log[d], plan))
    .sort();
  if (prevDone.length === 0) return len - 1; // 첫 회차: 마지막 종목을 쉼

  // 최근 3회의 종목별 수행 횟수
  const window = prevDone.slice(-3).map((d) => log[d]);
  const doneCount = list.map(
    (e) => window.filter((r) => r.doneIds.includes(e.id)).length
  );
  const maxCount = Math.max(...doneCount);

  // 평소 로테이션 후보: 직전에 실제로 쉰 종목의 다음 순서
  const prevSkip = skippedIndexOf(window[window.length - 1], plan);
  const rot = prevSkip < 0 ? len - 1 : (prevSkip - 1 + len) % len;

  // 로테이션 후보가 "가장 많이 한 종목"이면 그대로(안정 상태), 아니면 최근
  // 3회 중 최다 수행 종목을 쉬어 누락된 종목이 이번에 포함되게 합니다.
  return doneCount[rot] === maxCount ? rot : doneCount.indexOf(maxCount);
}

// 특정 날짜/부위에서 오늘 쉬어도 되는(추천에서 빠지는) 종목 id. 없으면 null.
export function restExerciseId(log, iso, type, plan) {
  const list = plan[type] || [];
  const idx = skipIndex(log, iso, type, plan);
  return idx >= 0 ? (list[idx]?.id ?? null) : null;
}

// 특정 날짜의 추천 종목: 직전 기록일이 완료면 반대, 미완료면 같은 부위. 없으면 상체.
export function suggestedType(log, iso, plan) {
  // 쉬는날은 로테이션 판단에서 건너뜁니다.
  const prevDates = Object.keys(log)
    .filter((d) => d < iso && log[d]?.type !== REST)
    .sort();
  if (prevDates.length === 0) return 'upper';
  const last = log[prevDates[prevDates.length - 1]];
  return isDayDone(last, plan) ? flip(last.type) : last.type;
}

// 화면에 표시할 종목: 기록이 있으면 그 종목, 없으면 추천 종목
export function displayType(log, iso, plan) {
  return log[iso]?.type ?? suggestedType(log, iso, plan);
}
