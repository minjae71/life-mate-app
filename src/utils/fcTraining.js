// FC온라인 훈련 관리 데이터 계층.
// 포메이션별로 선수 행(선수명/오버롤/훈련코치/등급)을 저장하고, 행마다 집중훈련
// (능력치 최대 5개, 각 +1~+2)을 기록합니다. 모든 데이터는 이 기기(localStorage)에만 저장.

export const TRAINING_KEY = 'fc:training';
export const ABILITIES_KEY = 'fc:abilities';

export const ENHANCE_LEVELS = Array.from({ length: 13 }, (_, i) => i + 1); // 강화 +1~+13
export const COACH_STARS = Array.from({ length: 10 }, (_, i) => i + 1); // 훈련코치 등급 별 1~10
export const MAX_FOCUS = 5; // 집중훈련으로 올릴 수 있는 능력 개수
export const MAX_PLUS = 2; // 능력 하나당 최대 +2

// 표준 포메이션 프리셋 + 11개 포지션 라벨. (게임 표기 기준의 대표 배치)
export const FORMATIONS = [
  { id: '433', name: '4-3-3', positions: ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CM', 'CM', 'LW', 'ST', 'RW'] },
  { id: '442', name: '4-4-2', positions: ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'] },
  { id: '4231', name: '4-2-3-1', positions: ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CDM', 'CAM', 'LW', 'RW', 'ST'] },
  { id: '41212', name: '4-1-2-1-2', positions: ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'LM', 'RM', 'CAM', 'ST', 'ST'] },
  { id: '352', name: '3-5-2', positions: ['GK', 'CB', 'CB', 'CB', 'LWB', 'CM', 'CM', 'CM', 'RWB', 'ST', 'ST'] },
  { id: '343', name: '3-4-3', positions: ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'RM', 'LW', 'ST', 'RW'] },
  { id: '532', name: '5-3-2', positions: ['GK', 'LWB', 'CB', 'CB', 'CB', 'RWB', 'CM', 'CM', 'CM', 'ST', 'ST'] },
  { id: '4321', name: '4-3-2-1', positions: ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CM', 'CM', 'CF', 'ST', 'CF'] },
];

export function formationById(id) {
  return FORMATIONS.find((f) => f.id === id) || FORMATIONS[0];
}

// 집중훈련 가능한 기본 세부 능력치 (카테고리, 이름). 사용자가 편집(추가/삭제) 가능.
const DEFAULT_ABILITY_DEFS = [
  ['스피드', '가속력'], ['스피드', '주력'],
  ['슛', '골 결정력'], ['슛', '슛 파워'], ['슛', '중거리 슛'], ['슛', '발리 슛'], ['슛', '페널티 킥'], ['슛', '위치 선정'],
  ['패스', '짧은 패스'], ['패스', '긴 패스'], ['패스', '크로스'], ['패스', '프리킥'], ['패스', '커브'],
  ['드리블', '볼 컨트롤'], ['드리블', '드리블'], ['드리블', '민첩성'], ['드리블', '밸런스'], ['드리블', '반응 속도'], ['드리블', '침착성'],
  ['수비', '태클'], ['수비', '적극성'], ['수비', '가로채기'], ['수비', '대인 수비'], ['수비', '헤더 정확도'], ['수비', '슬라이딩 태클'],
  ['피지컬', '몸싸움'], ['피지컬', '스태미너'], ['피지컬', '점프'], ['피지컬', '공격 성향'],
  ['골키핑', 'GK 다이빙'], ['골키핑', 'GK 핸들링'], ['골키핑', 'GK 킥'], ['골키핑', 'GK 반응 속도'], ['골키핑', 'GK 위치 선정'],
];

export function defaultAbilities() {
  return DEFAULT_ABILITY_DEFS.map(([category, name], i) => ({ id: `d${i}`, category, name }));
}

export function loadAbilities() {
  try {
    const arr = JSON.parse(localStorage.getItem(ABILITIES_KEY));
    if (Array.isArray(arr) && arr.length) return arr;
  } catch {
    /* 무시 */
  }
  return defaultAbilities();
}

export function saveAbilities(list) {
  localStorage.setItem(ABILITIES_KEY, JSON.stringify(list));
}

// 능력치 카테고리 표시 순서
export const ABILITY_CATEGORIES = ['스피드', '슛', '패스', '드리블', '수비', '피지컬', '골키핑'];

export function groupAbilities(list) {
  const groups = new Map();
  for (const a of list) {
    if (!groups.has(a.category)) groups.set(a.category, []);
    groups.get(a.category).push(a);
  }
  // 알려진 카테고리 먼저, 나머지는 뒤에
  const ordered = [];
  for (const c of ABILITY_CATEGORIES) if (groups.has(c)) ordered.push([c, groups.get(c)]);
  for (const [c, arr] of groups) if (!ABILITY_CATEGORIES.includes(c)) ordered.push([c, arr]);
  return ordered;
}

// ---- 훈련 데이터 (포메이션별 선수 행) --------------------------------------
export function emptyRow() {
  return { name: '', overall: '', enhance: '', coachName: '', coachGrade: '', focus: [] };
}

export function emptyRowsFor(formationId) {
  return formationById(formationId).positions.map(() => emptyRow());
}

export function loadTraining() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TRAINING_KEY));
    if (parsed && typeof parsed === 'object') {
      return {
        selectedFormation: parsed.selectedFormation || FORMATIONS[0].id,
        byFormation: parsed.byFormation && typeof parsed.byFormation === 'object' ? parsed.byFormation : {},
        orderByFormation:
          parsed.orderByFormation && typeof parsed.orderByFormation === 'object'
            ? parsed.orderByFormation
            : {},
      };
    }
  } catch {
    /* 무시 */
  }
  return { selectedFormation: FORMATIONS[0].id, byFormation: {}, orderByFormation: {} };
}

export function saveTraining(state) {
  localStorage.setItem(TRAINING_KEY, JSON.stringify(state));
}

// 포메이션의 행 목록을 가져오되, 없거나 길이가 안 맞으면 포지션 수에 맞춰 보정.
export function rowsForFormation(state, formationId) {
  const positions = formationById(formationId).positions;
  const saved = state.byFormation[formationId];
  const rows = Array.isArray(saved) ? saved : [];
  return positions.map((_, i) => {
    const r = rows[i] || emptyRow();
    return {
      name: r.name || '',
      overall: r.overall || '',
      enhance: r.enhance ?? r.grade ?? '', // 기존 grade(등급) 데이터는 강화 값으로 이관
      coachName: r.coachName || '',
      coachGrade: r.coachGrade || '',
      focus: Array.isArray(r.focus) ? r.focus : [],
    };
  });
}

// 포지션 표시 순서. 기본은 ST가 위로 오도록 역순.
export function defaultOrder(formationId) {
  const n = formationById(formationId).positions.length;
  return Array.from({ length: n }, (_, i) => n - 1 - i);
}

// 저장된 커스텀 순서가 유효한 순열이면 사용, 아니면 기본(역순).
export function orderForFormation(state, formationId) {
  const n = formationById(formationId).positions.length;
  const saved = state?.orderByFormation?.[formationId];
  if (Array.isArray(saved) && saved.length === n) {
    const set = new Set(saved);
    if (set.size === n && [...set].every((x) => Number.isInteger(x) && x >= 0 && x < n)) return saved;
  }
  return defaultOrder(formationId);
}

// 집중훈련 토글: 같은 능력·같은 +값이면 해제, 다른 +값이면 변경, 새 능력이면 추가(5개 초과 시 무시).
export function toggleFocus(focus, abilityId, plus) {
  const existing = focus.find((f) => f.abilityId === abilityId);
  if (existing) {
    if (existing.plus === plus) return focus.filter((f) => f.abilityId !== abilityId);
    return focus.map((f) => (f.abilityId === abilityId ? { ...f, plus } : f));
  }
  if (focus.length >= MAX_FOCUS) return focus;
  return [...focus, { abilityId, plus }];
}
