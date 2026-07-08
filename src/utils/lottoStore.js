// 로또/연금복권 통계 데이터 계층.
//  - 내장 스냅샷(src/data/lottoStats.json, 빌드 시점 실회차 빈도)을 기본값으로,
//  - 사용자가 추가한 회차(수동 입력 + '새 회차 자동 불러오기')를 localStorage에 쌓아
//    두 소스를 합쳐 생성 로직이 쓰는 가중치(출현 횟수)와 통계 화면 데이터를 만든다.
import { CapacitorHttp, Capacitor } from '@capacitor/core';
import snapshot from '../data/lottoStats.json';
import { LOTTO, PENSION } from './lotto';

export const EXTRA_DRAWS_KEY = 'lotto:extraDraws';
export const GEN_HISTORY_KEY = 'lotto:genHistory';
const MAX_GEN_HISTORY = 30;
const BASE = 'https://www.dhlottery.co.kr';

// ---- 생성 기록 (내가 뽑은 번호) --------------------------------------------
export function loadGenHistory() {
  try {
    const arr = JSON.parse(localStorage.getItem(GEN_HISTORY_KEY));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveGenHistory(list) {
  localStorage.setItem(GEN_HISTORY_KEY, JSON.stringify(list));
}

// generate() 결과를 기록에 추가(최신이 앞). 반환: 갱신된 목록.
export function addGeneration(result) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: result.generatedAt,
    mode: result.mode,
    lotteryType: result.lotteryType,
    tickets: result.tickets,
  };
  const next = [entry, ...loadGenHistory()].slice(0, MAX_GEN_HISTORY);
  saveGenHistory(next);
  return next;
}

export function removeGeneration(id) {
  saveGenHistory(loadGenHistory().filter((e) => e.id !== id));
}

export function clearGenHistory() {
  saveGenHistory([]);
}

// ---- 추가 회차 저장소 (수동 + 자동 통합, drawNo 로 중복 제거) -----------------
// 저장 형태: { lotto: [{drawNo, numbers:[6], bonus, date, source}], pension: [{drawNo, group, serial, date, source}] }
export function loadExtraDraws() {
  try {
    const parsed = JSON.parse(localStorage.getItem(EXTRA_DRAWS_KEY));
    return {
      lotto: Array.isArray(parsed?.lotto) ? parsed.lotto : [],
      pension: Array.isArray(parsed?.pension) ? parsed.pension : [],
    };
  } catch {
    return { lotto: [], pension: [] };
  }
}

export function saveExtraDraws(extra) {
  localStorage.setItem(EXTRA_DRAWS_KEY, JSON.stringify(extra));
}

// 스냅샷 최신 회차 이하의 것은 이미 반영돼 있으므로 무시한다.
function isNewerThanSnapshot(lotteryType, drawNo) {
  const latest = lotteryType === LOTTO ? snapshot.lotto.latestDrawNo : snapshot.pension.latestDrawNo;
  return drawNo > latest;
}

// 회차 추가(수동/자동 공용). 반환: { added, reason }
export function addDraw(lotteryType, draw, source = 'manual') {
  const extra = loadExtraDraws();
  const key = lotteryType === LOTTO ? 'lotto' : 'pension';
  if (!isNewerThanSnapshot(lotteryType, draw.drawNo)) {
    return { added: false, reason: 'snapshot' }; // 이미 스냅샷에 포함된 회차
  }
  if (extra[key].some((d) => d.drawNo === draw.drawNo)) {
    return { added: false, reason: 'duplicate' };
  }
  extra[key].push({ ...draw, source });
  extra[key].sort((a, b) => b.drawNo - a.drawNo);
  saveExtraDraws(extra);
  return { added: true };
}

export function removeDraw(lotteryType, drawNo) {
  const extra = loadExtraDraws();
  const key = lotteryType === LOTTO ? 'lotto' : 'pension';
  extra[key] = extra[key].filter((d) => d.drawNo !== drawNo);
  saveExtraDraws(extra);
}

export function latestKnownDrawNo(lotteryType) {
  const extra = loadExtraDraws();
  const key = lotteryType === LOTTO ? 'lotto' : 'pension';
  const snap = lotteryType === LOTTO ? snapshot.lotto.latestDrawNo : snapshot.pension.latestDrawNo;
  const extraMax = extra[key].reduce((m, d) => Math.max(m, d.drawNo), 0);
  return Math.max(snap, extraMax);
}

// ---- 가중치 / 통계 (스냅샷 + 추가 회차 합산) ---------------------------------
export function computeWeights() {
  const extra = loadExtraDraws();

  // 로또 번호(1~45) 출현 횟수
  const lottoNumbers = {};
  for (let n = 1; n <= 45; n++) lottoNumbers[n] = snapshot.lotto.numberCounts[n] || 0;
  for (const d of extra.lotto) for (const n of d.numbers) lottoNumbers[n] = (lottoNumbers[n] || 0) + 1;

  // 연금 조(1~5)
  const pensionGroups = {};
  for (let g = 1; g <= 5; g++) pensionGroups[g] = snapshot.pension.groupCounts[g] || 0;
  for (const d of extra.pension) {
    if (d.group >= 1 && d.group <= 5) pensionGroups[d.group] += 1;
  }

  // 연금 자리별(1~6) 숫자(0~9) + 전체 숫자 합
  const positionDigits = {};
  const pensionDigits = {};
  for (let p = 1; p <= 6; p++) {
    positionDigits[p] = {};
    for (let dgt = 0; dgt <= 9; dgt++) {
      const base = snapshot.pension.positionDigitCounts[p]?.[dgt] || 0;
      positionDigits[p][dgt] = base;
    }
  }
  for (const d of extra.pension) {
    const s = String(d.serial).padStart(6, '0').slice(-6);
    for (let p = 1; p <= 6; p++) {
      const digit = Number(s[p - 1]);
      if (Number.isInteger(digit)) positionDigits[p][digit] += 1;
    }
  }
  for (let dgt = 0; dgt <= 9; dgt++) {
    let sum = 0;
    for (let p = 1; p <= 6; p++) sum += positionDigits[p][dgt];
    pensionDigits[dgt] = sum;
  }

  return {
    weights: { lottoNumbers, pensionGroups, pensionDigits },
    lottoTotalDraws: snapshot.lotto.totalDraws + extra.lotto.length,
    pensionTotalDraws: snapshot.pension.totalDraws + extra.pension.length,
    positionDigits,
    pensionGroupsView: pensionGroups,
  };
}

// 통계 화면용: 로또 번호 출현 횟수 내림차순
export function lottoFrequencyList(lottoNumbers) {
  return Object.entries(lottoNumbers)
    .map(([n, appearances]) => ({ number: Number(n), appearances }))
    .sort((a, b) => b.appearances - a.appearances || a.number - b.number);
}

export function snapshotInfo() {
  return {
    asOf: snapshot.asOf,
    lottoLatest: snapshot.lotto.latestDrawNo,
    pensionLatest: snapshot.pension.latestDrawNo,
  };
}

// ---- 새 회차 자동 불러오기 (동행복권 API) -----------------------------------
// Capacitor 네이티브에서는 CapacitorHttp 로 CORS 없이 호출된다. 웹(개발)에서는
// CORS 로 막힐 수 있어 그때는 안내 메시지를 던진다.
async function httpGet(url, as = 'json') {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({
      url,
      headers: { Accept: as === 'json' ? 'application/json' : 'text/html', 'User-Agent': 'Mozilla/5.0' },
      responseType: as === 'json' ? 'json' : 'text',
    });
    if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
    if (as === 'json') return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    return String(res.data ?? '');
  }
  // 웹(개발 브라우저)에서는 dhlottery CORS 로 막힐 수 있다.
  const res = await fetch(url, { headers: { Accept: as === 'json' ? 'application/json' : 'text/html' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return as === 'json' ? res.json() : res.text();
}

function ymdToIso(ymd) {
  const s = String(ymd);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

async function fetchLatestLottoNo() {
  const html = await httpGet(`${BASE}/lt645/result`, 'text');
  let latest = 0;
  for (const m of html.matchAll(/(\d+)회/g)) latest = Math.max(latest, parseInt(m[1], 10));
  return latest;
}

// knownMax 초과 회차만 수집
async function fetchNewLottoDraws(knownMax) {
  const latest = await fetchLatestLottoNo();
  if (!latest || latest <= knownMax) return [];
  const collected = [];
  let cursor = latest;
  let first = true;
  while (true) {
    const params = new URLSearchParams();
    params.set('srchDir', first ? 'center' : 'older');
    params.set(first ? 'srchLtEpsd' : 'srchCursorLtEpsd', String(cursor));
    const json = await httpGet(`${BASE}/lt645/selectPstLt645InfoNew.do?${params}`, 'json');
    const list = json?.data?.list ?? [];
    if (list.length === 0) break;
    let minNo = Infinity;
    for (const it of list) {
      minNo = Math.min(minNo, it.ltEpsd);
      if (it.ltEpsd > knownMax) {
        collected.push({
          drawNo: it.ltEpsd,
          date: ymdToIso(it.ltRflYmd),
          numbers: [it.tm1WnNo, it.tm2WnNo, it.tm3WnNo, it.tm4WnNo, it.tm5WnNo, it.tm6WnNo],
          bonus: it.bnsWnNo,
        });
      }
    }
    if (minNo <= knownMax + 1 || minNo <= 1 || cursor === minNo) break;
    cursor = minNo;
    first = false;
  }
  return collected;
}

async function fetchNewPensionDraws(knownMax) {
  const json = await httpGet(`${BASE}/pt720/selectPstPt720WnList.do`, 'json');
  const result = json?.data?.result ?? [];
  return result
    .filter((it) => it.psltEpsd > knownMax)
    .map((it) => ({
      drawNo: it.psltEpsd,
      date: ymdToIso(it.psltRflYmd),
      group: parseInt(it.wnBndNo, 10),
      serial: String(it.wnRnkVl),
    }));
}

// 두 복권 모두 새 회차를 받아 저장. 반환 { lotto, pension } = 각 추가된 개수.
export async function fetchNewDraws() {
  const lottoNew = await fetchNewLottoDraws(latestKnownDrawNo(LOTTO));
  let lottoAdded = 0;
  for (const d of lottoNew) if (addDraw(LOTTO, d, 'auto').added) lottoAdded++;

  const pensionNew = await fetchNewPensionDraws(latestKnownDrawNo(PENSION));
  let pensionAdded = 0;
  for (const d of pensionNew) if (addDraw(PENSION, d, 'auto').added) pensionAdded++;

  return { lotto: lottoAdded, pension: pensionAdded };
}
