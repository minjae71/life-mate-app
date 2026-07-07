// 앱 데이터(localStorage) 관리. 설정 화면의 '데이터 삭제'에서 사용합니다.
// 각 기능이 쓰는 키를 그룹으로 모아, 기능별 초기화와 전체 초기화를 지원합니다.

// 기능별 저장 키 그룹 (각 컴포넌트가 쓰는 키와 일치해야 합니다)
export const DATA_GROUPS = [
  { id: 'todo', label: '오늘의 할일', keys: ['todos:items', 'todos:checked'] },
  { id: 'workout', label: '운동 기록', keys: ['workout:plan', 'workout:log'] },
  {
    id: 'work',
    label: '근무시간 (출·퇴근 기록)',
    keys: ['workhours:entries', 'workhours:break'],
  },
  { id: 'holidays', label: '공휴일 (직접 등록)', keys: ['workhours:customHolidays'] },
  { id: 'maplemvp', label: '메이플 MVP (기준·입력값)', keys: ['maple:mvp:grades', 'maple:mvp:state'] },
  { id: 'fcfee', label: 'FC온라인 수수료 (입력값)', keys: ['fc:fee:state'] },
  { id: 'loan', label: '정산 관리', keys: ['loan:people'] },
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
