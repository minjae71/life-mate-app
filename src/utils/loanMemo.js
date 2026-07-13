// 정산 관리: 사람별로 상세 내역(날짜·내용·금액)을 모아 합산합니다.
import { loadJSON, saveJSON } from './storage.js';

export const PEOPLE_KEY = 'loan:people';

export function loadPeople() {
  return loadJSON(PEOPLE_KEY, []);
}
export function savePeople(people) {
  saveJSON(PEOPLE_KEY, people);
}

// 한 사람의 상세 내역 합계
export function personTotal(person) {
  return (person.entries || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
}

// 전체 합계
export function grandTotal(people) {
  return people.reduce((s, p) => s + personTotal(p), 0);
}
