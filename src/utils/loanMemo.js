// 정산 관리: 사람별로 상세 내역(날짜·내용·금액)을 모아 합산합니다.
export const PEOPLE_KEY = 'loan:people';

export function loadPeople() {
  try {
    return JSON.parse(localStorage.getItem(PEOPLE_KEY)) || [];
  } catch {
    return [];
  }
}
export function savePeople(people) {
  localStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
}

// 한 사람의 상세 내역 합계
export function personTotal(person) {
  return (person.entries || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
}

// 전체 합계
export function grandTotal(people) {
  return people.reduce((s, p) => s + personTotal(p), 0);
}
