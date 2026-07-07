// GTX-A 연계 출발 계산 로직
// -----------------------------------------------------------------------------
// "출발 마감 시각" 방식:
//   각 GTX-A 수서 출발 열차마다, 출발역에서 늦어도 언제까지 출발하면
//   (소요시간 + 환승시간을 더해) 그 열차를 탈 수 있는지를 계산합니다.
//   => 마감 시각 = GTX 출발 - 환승시간 - 출발역→수서 소요시간
//   마감 시각까지 출발하는 것이 "가장 효율적"(불필요한 대기 없이 가장 늦게 출발)입니다.

import {
  GTX_SUSEO_DEPARTURES,
  TRANSFER_MINUTES,
  GTX_SUSEO_TO_DONGTAN_MINUTES,
} from '../data/gtxSchedule.js';

const MINUTES_PER_DAY = 24 * 60;
const SECONDS_PER_DAY = MINUTES_PER_DAY * 60;

// "HH:MM" 또는 "HH:MM:SS" (24시 초과 표기 허용) -> 자정 기준 초(second)
export function parseToSeconds(str) {
  const [h, m, s = 0] = str.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

// 초(second) -> 분(minute), "올림". 예) 17:22:30(=초) -> 17:23(=분)
// 네이버 길찾기가 30초 단위 열차를 다음 분으로 올려 표시하는 방식과 동일합니다.
export function roundUpToMinute(seconds) {
  return Math.ceil(seconds / 60);
}

// 분(minute) -> "HH:MM" 표시 문자열. 24시를 넘기면 익일로 환산해 표시합니다.
export function formatMinutes(min) {
  const normalized = ((min % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  const nextDay = min >= MINUTES_PER_DAY;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return nextDay ? `익일 ${hh}:${mm}` : `${hh}:${mm}`;
}

// 현재 시각(Date) -> 운행일 기준 초.
// 새벽(04시 이전)은 전날 밤 열차(24:xx)와 이어지도록 +24시간 처리합니다.
export function nowToServiceSeconds(now = new Date()) {
  const seconds =
    now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  return now.getHours() < 4 ? seconds + SECONDS_PER_DAY : seconds;
}

// 사용자가 고른 시각("HH:MM") -> 운행일 기준 초. (04시 이전은 +24시간)
export function clockToServiceSeconds(str) {
  const [h, m] = str.split(':').map(Number);
  const seconds = h * 3600 + m * 60;
  return h < 4 ? seconds + SECONDS_PER_DAY : seconds;
}

/**
 * 수인분당선 시간표를 연계해, GTX마다 "실제로 타야 할 수인분당선 열차"를 계산합니다.
 * 각 GTX 열차에 대해 [출발 마감(=GTX-환승-소요) 이전에 출발하는 마지막 열차]를 고릅니다.
 * (= 가장 늦게 출발하면서 그 GTX를 탈 수 있는 열차 = 네이버가 추천하는 열차)
 *
 * @param {{minutesToSuseo:number}} origin - 출발역 (ORIGINS 항목)
 * @param {number} nowSeconds - 현재 운행일 기준 초 (nowToServiceSeconds 결과)
 * @param {string[]} departures - 해당 역의 하행 출발 시각표 ("HH:MM" | "HH:MM:SS")
 * @returns {Array<{
 *   trainSeconds:number,      // 수인분당선 실제 출발 (초)
 *   trainLabelMinutes:number, // 표시용 출발 시각 (분, 올림)
 *   hasSeconds:boolean,       // 원본이 초 단위(예: :30)였는지
 *   gtxDeparture:number,      // GTX 수서 출발 (분)
 *   dongtanArrival:number     // 동탄 도착 (분, 참고)
 * }>}
 */
export function computeTimetableConnections(origin, nowSeconds, departures) {
  const leadSeconds = (TRANSFER_MINUTES + origin.minutesToSuseo) * 60;
  const trains = departures
    .map(parseToSeconds)
    .sort((a, b) => a - b);

  const result = [];
  let usedTrain = null;

  for (const str of GTX_SUSEO_DEPARTURES) {
    const gtxSeconds = parseToSeconds(str);
    const deadlineSeconds = gtxSeconds - leadSeconds;

    // 출발 마감 이전에 출발하는 마지막 열차를 찾습니다.
    // 엄격한 부등호(<): 수서 도착+환승이 GTX 출발과 "같은" 열차는 탈 수 없습니다.
    // (예: 강남 17:29 출발 → 17:47 도착 완료 = GTX 17:47 출발 순간이라 못 탐)
    let candidate = null;
    for (const t of trains) {
      if (t < deadlineSeconds) candidate = t;
      else break;
    }

    if (candidate === null) continue; // 이 GTX에 댈 수 있는 열차가 없음
    if (candidate < nowSeconds) continue; // 마지막 연계 열차가 이미 떠남
    if (candidate === usedTrain) continue; // 앞선 GTX에서 이미 표시한 열차

    const gtxMinutes = Math.round(gtxSeconds / 60);
    result.push({
      trainSeconds: candidate,
      trainLabelMinutes: roundUpToMinute(candidate),
      hasSeconds: candidate % 60 !== 0,
      gtxDeparture: gtxMinutes,
      dongtanArrival: gtxMinutes + GTX_SUSEO_TO_DONGTAN_MINUTES,
    });
    usedTrain = candidate;
  }

  return result;
}
