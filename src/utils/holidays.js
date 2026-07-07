// 공휴일 관리: 내장 공휴일(data/holidays.js) + 사용자가 등록한 공휴일(localStorage) 병합
import { HOLIDAYS as BUILTIN_HOLIDAYS } from '../data/holidays.js';

const CUSTOM_KEY = 'workhours:customHolidays';

export function loadCustomHolidays() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_KEY)) || {};
  } catch {
    return {};
  }
}

export function saveCustomHolidays(map) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(map));
}

// 계산에 사용할 병합 공휴일 맵. 사용자 등록이 내장보다 우선합니다.
export function getMergedHolidays() {
  return { ...BUILTIN_HOLIDAYS, ...loadCustomHolidays() };
}

export { BUILTIN_HOLIDAYS };
