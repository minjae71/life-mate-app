// 앱 데이터(localStorage) 관리. 설정 화면의 '데이터 삭제'에서 사용합니다.
// 각 기능이 쓰는 키를 그룹으로 모아, 기능별 초기화와 전체 초기화를 지원합니다.

// localStorage JSON 읽기/쓰기 헬퍼. 파싱 실패나 값 없음이면 fallback을 돌려줍니다.
// (각 기능의 load 함수에서 반복되던 try/catch 보일러플레이트를 대체)
export function loadJSON(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}
export function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// 기능별 저장 키 그룹 (각 컴포넌트가 쓰는 키와 일치해야 합니다)
export const DATA_GROUPS = [
  { id: 'todo', label: '오늘의 할일', keys: ['todos:items', 'todos:checked', 'todos:sections'] },
  { id: 'workout', label: '운동 기록', keys: ['workout:plan', 'workout:log'] },
  {
    id: 'work',
    label: '근무시간 (출·퇴근 기록)',
    keys: ['workhours:entries', 'workhours:break'],
  },
  { id: 'holidays', label: '공휴일 (직접 등록)', keys: ['workhours:customHolidays'] },
  { id: 'maplemvp', label: '메이플 MVP (기준·입력값)', keys: ['maple:mvp:grades', 'maple:mvp:state'] },
  { id: 'fconline', label: 'FC온라인 (수수료·훈련 기록)', keys: ['fc:fee:state', 'fc:training', 'fc:abilities'] },
  { id: 'datecalc', label: '날짜 계산기 (기념일)', keys: ['datecalc:anniversaries'] },
  { id: 'loan', label: '정산 관리', keys: ['loan:people'] },
  { id: 'insta', label: '인스타 분석 기록', keys: ['insta:snapshots'] },
  { id: 'lotto', label: '로또/연금복권 (추가 회차·생성 기록)', keys: ['lotto:extraDraws', 'lotto:genHistory'] },
];

// 특정 기능 그룹의 데이터만 삭제
export function clearGroup(groupId) {
  const group = DATA_GROUPS.find((g) => g.id === groupId);
  if (!group) return;
  group.keys.forEach((k) => localStorage.removeItem(k));
}

// 모든 기능 데이터 삭제 (테마 등 앱 설정은 유지)
export function clearAllData() {
  DATA_GROUPS.forEach((g) => g.keys.forEach((k) => localStorage.removeItem(k)));
}
