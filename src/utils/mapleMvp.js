// 메이플스토리 MVP 계산 로직
// -----------------------------------------------------------------------------
// MVP 등급은 "최근 13주 누적 캐시 결제 금액"으로 산정됩니다. (2025-12-18부터 3개월→13주)
// 넥슨이 공식 기준 금액을 공개하지 않으므로, 아래 기본값은 통상 알려진 추정치이며
// 사용자가 화면에서 직접 수정할 수 있습니다. (게임 내 MVP UI 값 기준으로 보정)
import { loadJSON, saveJSON } from './storage.js';

export const GRADES_KEY = 'maple:mvp:grades';
export const STATE_KEY = 'maple:mvp:state';

// 기준 금액 단위: 원 (넥슨캐시 1원 = 1캐시)
export const DEFAULT_GRADES = [
  { id: 'bronze', name: '브론즈', color: '#b45309', threshold: 150000 },
  { id: 'silver', name: '실버', color: '#64748b', threshold: 300000 },
  { id: 'gold', name: '골드', color: '#d97706', threshold: 500000 },
  { id: 'diamond', name: '다이아', color: '#0891b2', threshold: 1000000 },
  { id: 'red', name: '레드', color: '#dc2626', threshold: 3000000 },
  { id: 'black', name: '블랙', color: '#111827', threshold: 5000000 },
];

// 저장된 사용자 기준값을 기본 정의(이름/색) 위에 병합해서 반환
export function loadGrades() {
  const saved = loadJSON(GRADES_KEY, null);
  if (Array.isArray(saved) && saved.length) {
    return DEFAULT_GRADES.map((g) => {
      const s = saved.find((x) => x.id === g.id);
      return s && Number.isFinite(s.threshold) ? { ...g, threshold: s.threshold } : g;
    });
  }
  return DEFAULT_GRADES;
}

export function saveGrades(grades) {
  const slim = grades.map(({ id, threshold }) => ({ id, threshold }));
  saveJSON(GRADES_KEY, slim);
}

export function loadState() {
  return loadJSON(STATE_KEY, {});
}
export function saveState(state) {
  saveJSON(STATE_KEY, state);
}

/**
 * 누적 결제액(원)으로 현재 등급/다음 등급/진행도를 계산합니다.
 * @param {number} spent - 최근 13주 누적 결제 금액(원)
 * @param {Array} grades - 등급 정의 (threshold 오름차순 정렬은 내부에서 처리)
 */
export function computeMvp(spent, grades) {
  const sorted = [...grades].sort((a, b) => a.threshold - b.threshold);
  let current = null;
  let next = null;
  for (const g of sorted) {
    if (spent >= g.threshold) current = g;
    else {
      next = g;
      break;
    }
  }
  const remainingToNext = next ? Math.max(0, next.threshold - spent) : 0;

  // 현재 등급 구간 내 진행도 (현재 등급 기준액 → 다음 등급 기준액)
  const base = current ? current.threshold : 0;
  const ceil = next ? next.threshold : base;
  const progress = next && ceil > base ? Math.min(1, Math.max(0, (spent - base) / (ceil - base))) : 1;

  return { current, next, remainingToNext, progress, sorted };
}

// 남은 실적(원)에 회수율을 적용한 "실제 드는 현금(원)".
// 회수율 R% = 캐시템을 되팔아 돌려받는 비율. 실비용 = 남은실적 × (100 − R)/100.
export function netCash(remainingWon, recoveryPct) {
  const r = Math.min(100, Math.max(0, Number(recoveryPct) || 0));
  return Math.round(remainingWon * (1 - r / 100));
}

// 원 단위 표시: "1,000,000원" + 만/억 요약
// 큰 금액을 "500만원 / 1억 2,000만원"처럼 요약
export function fmtWonShort(n) {
  if (!Number.isFinite(n)) return '-';
  const won = Math.round(n);
  if (won < 10000) return `${won.toLocaleString('ko-KR')}원`;
  const eok = Math.floor(won / 100000000);
  const man = Math.floor((won % 100000000) / 10000);
  const parts = [];
  if (eok) parts.push(`${eok}억`);
  if (man) parts.push(`${man.toLocaleString('ko-KR')}만`);
  return `${parts.join(' ')}원`;
}
