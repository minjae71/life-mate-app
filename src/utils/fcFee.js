// FC온라인 이적시장 수수료 계산 (공식 계산기 방식: 다중 입력창)
// -----------------------------------------------------------------------------
// 기본 수수료율 40% (판매가 기준). 할인은 "수수료에서" 합산 차감됩니다.
//   프리미엄 PC방 30% · TOP CLASS 20% · 쿠폰 %(줄별 또는 일괄)
//   예) PC방+TOP CLASS = 수수료의 50% 할인 → 실질 수수료 = 40% × (1-0.5) = 판매가의 20%
// 판매 금액은 공식 사이트와 동일하게 "억 BP" 단위로 입력합니다. (1억 BP = 100,000,000)

export const BASE_FEE_RATE = 0.4; // 40%
export const PCBANG_PCT = 30; // 프리미엄 PC방: 수수료 30% 할인
export const TOPCLASS_PCT = 20; // TOP CLASS: 수수료 20% 할인
export const EOK = 100000000; // 1억
export const STATE_KEY = 'fc:fee:state';

// 억 BP 입력값 → BP 정수
export function eokToBp(eok) {
  return Math.round((Number(eok) || 0) * EOK);
}

// 실질 수수료(BP) = gross × 0.40 × (100 − discountSum)/100.
// 부동소수 오차(예: 0.4×(1−0.8)=0.0799999…로 1 BP 손실)와 큰 수 오버플로를
// 막기 위해 BigInt 정수연산으로 정확히 계산합니다. 쿠폰 소수점(예 12.5%)도 지원.
export function feeOf(grossBp, discountSum) {
  const ds = Math.min(100, Math.max(0, discountSum));
  const remHundredths = Math.round((100 - ds) * 100); // (100−ds)를 1/100 정밀도 정수로
  const g = BigInt(Math.round(grossBp));
  // fee = g × 40 × remHundredths / (100 × 10000)
  return Number((g * 40n * BigInt(remHundredths)) / 1000000n);
}

/**
 * 입력창 한 줄 계산.
 * @param {{amountEok:number, qty:number, coupon:number}} row
 * @param {{pcbang:boolean, topclass:boolean, bulkCouponOn:boolean, bulkCoupon:number}} ctx
 */
export function computeRow(row, ctx) {
  const gross = eokToBp(row.amountEok) * Math.max(1, Math.floor(row.qty) || 1);
  const coupon = ctx.bulkCouponOn ? Number(ctx.bulkCoupon) || 0 : Number(row.coupon) || 0;
  const discountSum = Math.min(
    100,
    (ctx.pcbang ? PCBANG_PCT : 0) + (ctx.topclass ? TOPCLASS_PCT : 0) + coupon
  );
  const baseFee = feeOf(gross, 0);
  const fee = feeOf(gross, discountSum);
  return {
    gross,
    coupon,
    discountSum,
    baseFee,
    fee,
    discount: baseFee - fee, // 수수료 할인 금액
    net: gross - fee, // 실수령
  };
}

// 전체 줄 합산 → { perRow:[...], totals:{...} }
export function computeAll(rows, ctx) {
  const perRow = rows.map((r) => computeRow(r, ctx));
  const totals = perRow.reduce(
    (acc, r) => ({
      gross: acc.gross + r.gross,
      baseFee: acc.baseFee + r.baseFee,
      fee: acc.fee + r.fee,
      discount: acc.discount + r.discount,
      net: acc.net + r.net,
    }),
    { gross: 0, baseFee: 0, fee: 0, discount: 0, net: 0 }
  );
  return { perRow, totals };
}

export function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY)) || {};
  } catch {
    return {};
  }
}
export function saveState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

export function fmtBp(n) {
  if (!Number.isFinite(n)) return '-';
  return Math.round(n).toLocaleString('ko-KR');
}

// 조/억/만 단위 요약 (예: 4,200,000,000,000 → "4조 2,000억", 1,203,000,000 → "12억 300만")
const JO = 1000000000000; // 1조
export function fmtBpShort(n) {
  if (!Number.isFinite(n)) return '-';
  const v = Math.round(n);
  if (v < 10000) return v.toLocaleString('ko-KR');
  const jo = Math.floor(v / JO);
  const eok = Math.floor((v % JO) / EOK);
  const man = Math.floor((v % EOK) / 10000);
  const parts = [];
  if (jo) parts.push(`${jo.toLocaleString('ko-KR')}조`);
  if (eok) parts.push(`${eok.toLocaleString('ko-KR')}억`);
  if (man) parts.push(`${man.toLocaleString('ko-KR')}만`);
  return parts.length ? parts.join(' ') : v.toLocaleString('ko-KR');
}
