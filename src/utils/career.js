// 경력 관리 로직 (localStorage 저장)
// -----------------------------------------------------------------------------
// D:\workspace\mjkim 포트폴리오 시스템의 서버 기반 경력(Career) 기능을
// 서버 없이 이 기기(localStorage)에 저장하는 형태로 이식한 것입니다.
// 수행처·관련 기술은 공통코드 대신 자유 입력으로 처리합니다.

export const CAREER_KEY = 'career:list';

export function loadCareers() {
  try {
    const arr = JSON.parse(localStorage.getItem(CAREER_KEY));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// 연도 선택지: 올해 → 1980년 (내림차순)
export function yearOptions() {
  const now = new Date().getFullYear();
  const arr = [];
  for (let y = now; y >= 1980; y--) arr.push(y);
  return arr;
}

export const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

// 정렬 기준값: 시작 연·월을 하나의 숫자로. 최신이 큰 값.
function startKey(c) {
  return (Number(c.startYear) || 0) * 12 + (Number(c.startMonth) || 0);
}

// 정렬 옵션 목록 (UI 드롭다운용)
export const SORT_OPTIONS = [
  { value: 'recent', label: '최신순' },
  { value: 'oldest', label: '오래된순' },
  { value: 'workplace', label: '수행처별' },
];

// 정렬. 기본은 최신순(시작기간 내림차순).
// 'workplace'는 수행처 가나다순, 같은 수행처 안에서는 최신순.
export function sortCareers(list, sort = 'recent') {
  const arr = [...list];
  if (sort === 'oldest') {
    return arr.sort((a, b) => startKey(a) - startKey(b));
  }
  if (sort === 'workplace') {
    return arr.sort((a, b) => {
      const cmp = (a.workplace || '').localeCompare(b.workplace || '', 'ko');
      return cmp !== 0 ? cmp : startKey(b) - startKey(a);
    });
  }
  return arr.sort((a, b) => startKey(b) - startKey(a));
}

const pad2 = (n) => String(n).padStart(2, '0');

// "2024.01 ~ 2025.06" / 진행 중이면 "2024.01 ~ 현재"
export function formatPeriod(c) {
  const start = `${c.startYear}.${pad2(c.startMonth)}`;
  if (c.ongoing || !c.endYear || !c.endMonth) return `${start} ~ 현재`;
  return `${start} ~ ${c.endYear}.${pad2(c.endMonth)}`;
}

// 근무 개월 수(포함) → "N년 M개월" 문자열. 종료가 없으면 오늘까지 계산.
export function formatDuration(c) {
  if (!c.startYear || !c.startMonth) return '';
  const now = new Date();
  const endY = c.ongoing || !c.endYear ? now.getFullYear() : Number(c.endYear);
  const endM = c.ongoing || !c.endMonth ? now.getMonth() + 1 : Number(c.endMonth);
  let months = (endY - Number(c.startYear)) * 12 + (endM - Number(c.startMonth)) + 1;
  if (months <= 0) return '';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [years ? `${years}년` : '', rest ? `${rest}개월` : ''].filter(Boolean).join(' ');
}

// 폼 기본값
export function emptyCareer() {
  const now = new Date();
  return {
    workplace: '',
    projectName: '',
    role: '',
    startYear: now.getFullYear(),
    startMonth: now.getMonth() + 1,
    endYear: '',
    endMonth: '',
    ongoing: false,
    technologies: [],
  };
}

// 저장 전 유효성: 필수값(수행처/프로젝트명/시작기간)이 있는지
export function isValidCareer(c) {
  return Boolean(
    c.workplace?.trim() &&
      c.projectName?.trim() &&
      c.startYear &&
      c.startMonth
  );
}
