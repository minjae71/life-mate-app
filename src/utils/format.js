// 금액(원) 표시 포맷. "1,234,000원". 여러 기능에서 공용으로 씁니다.
export function fmtWon(n) {
  if (!Number.isFinite(n)) return '0원';
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}
