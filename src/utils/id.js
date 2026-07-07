// 간단한 고유 ID 생성 (localStorage 항목 키용). 여러 기능에서 공용으로 씁니다.
export function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
