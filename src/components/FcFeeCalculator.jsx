import { useEffect, useMemo, useState } from 'react';
import {
  BASE_FEE_RATE,
  PCBANG_PCT,
  TOPCLASS_PCT,
  computeAll,
  fmtBp,
  fmtBpShort,
  loadState,
  saveState,
} from '../utils/fcFee';

let seq = 0;
const newRow = () => ({ id: `r${Date.now()}-${seq++}`, amountEok: '', qty: 1, coupon: '' });

// FC온라인 이적시장 수수료 계산기 (공식 사이트 방식: 여러 입력창 + 할인 조절)
export default function FcFeeCalculator() {
  const saved = useMemo(loadState, []);
  const [rows, setRows] = useState(() =>
    Array.isArray(saved.rows) && saved.rows.length
      ? saved.rows.map((r) => ({ id: `r${Date.now()}-${seq++}`, ...r }))
      : [newRow()]
  );
  const [pcbang, setPcbang] = useState(saved.pcbang ?? true);
  const [topclass, setTopclass] = useState(saved.topclass ?? true);
  const [bulkCouponOn, setBulkCouponOn] = useState(saved.bulkCouponOn ?? false);
  const [bulkCoupon, setBulkCoupon] = useState(saved.bulkCoupon ?? 0);

  const ctx = { pcbang, topclass, bulkCouponOn, bulkCoupon };
  const { perRow, totals } = useMemo(() => computeAll(rows, ctx), [rows, ctx]);

  useEffect(() => {
    const slimRows = rows.map(({ amountEok, qty, coupon }) => ({ amountEok, qty, coupon }));
    saveState({ rows: slimRows, pcbang, topclass, bulkCouponOn, bulkCoupon });
  }, [rows, pcbang, topclass, bulkCouponOn, bulkCoupon]);

  function updateRow(id, field, value) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }
  function qtyDelta(id, delta) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, qty: Math.max(1, (Number(r.qty) || 1) + delta) } : r))
    );
  }
  function addRow() {
    setRows((prev) => [...prev, newRow()]);
  }
  function removeRow(id) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  }

  return (
    <section style={styles.section}>
      <h2 style={styles.groupTitle}>판매 예정 금액</h2>

      {rows.map((row, i) => {
        const r = perRow[i];
        return (
          <div key={row.id} style={styles.rowCard}>
            <div style={styles.rowMain}>
              <div style={styles.amountWrap}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="판매 금액 입력"
                  value={row.amountEok}
                  onChange={(e) => updateRow(row.id, 'amountEok', e.target.value)}
                  style={styles.amountInput}
                />
                <span style={styles.unit}>억 BP</span>
              </div>
              {rows.length > 1 && (
                <button style={styles.removeBtn} onClick={() => removeRow(row.id)} aria-label="삭제">
                  −
                </button>
              )}
            </div>

            <div style={styles.rowSub}>
              <div style={styles.qtyBox}>
                <button style={styles.stepBtn} onClick={() => qtyDelta(row.id, -1)}>
                  −
                </button>
                <span style={styles.qtyText}>{row.qty}명</span>
                <button style={styles.stepBtn} onClick={() => qtyDelta(row.id, 1)}>
                  +
                </button>
              </div>

              <div style={styles.couponBox}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="쿠폰"
                  disabled={bulkCouponOn}
                  value={bulkCouponOn ? bulkCoupon : row.coupon}
                  onChange={(e) => updateRow(row.id, 'coupon', e.target.value)}
                  style={{ ...styles.couponInput, ...(bulkCouponOn ? styles.disabledInput : {}) }}
                />
                <span style={styles.couponPct}>%</span>
              </div>
            </div>

            <div style={styles.rowResult}>
              <span>실수령 {fmtBp(r.net)} BP</span>
              <span style={styles.rowFee}>수수료 -{fmtBp(r.fee)} BP</span>
            </div>
          </div>
        );
      })}

      <button style={styles.addBtn} onClick={addRow}>
        + 입력창 추가
      </button>

      <div style={styles.totalLine}>
        <span>판매 예정 금액</span>
        <strong style={styles.totalGross}>{fmtBp(totals.gross)} BP</strong>
      </div>

      {/* 수수료 할인 */}
      <h2 style={styles.groupTitle}>수수료 할인</h2>
      <div style={styles.card}>
        <ToggleRow
          label={`프리미엄 PC방 · 기본수수료 ${PCBANG_PCT}% 할인`}
          on={pcbang}
          onToggle={() => setPcbang((v) => !v)}
        />
        <ToggleRow
          label={`TOP CLASS · 기본수수료 ${TOPCLASS_PCT}% 할인`}
          on={topclass}
          onToggle={() => setTopclass((v) => !v)}
        />
        <div style={styles.bulkRow}>
          <ToggleRow
            label="일괄 쿠폰 적용"
            on={bulkCouponOn}
            onToggle={() => setBulkCouponOn((v) => !v)}
            noBorder
          />
          <div style={styles.bulkInputWrap}>
            <input
              type="number"
              min="0"
              max="100"
              disabled={!bulkCouponOn}
              value={bulkCoupon}
              onChange={(e) =>
                setBulkCoupon(Math.min(100, Math.max(0, Number(e.target.value))))
              }
              style={{ ...styles.bulkInput, ...(!bulkCouponOn ? styles.disabledInput : {}) }}
            />
            <span style={styles.couponPct}>%</span>
          </div>
        </div>
      </div>

      {/* 결과 */}
      <div style={styles.resultCard}>
        <ResultRow label={`기본 수수료 (${BASE_FEE_RATE * 100}%)`} value={`${fmtBp(totals.baseFee)} BP`} />
        <ResultRow
          label="수수료 할인 금액"
          value={`-${fmtBp(totals.discount)} BP`}
          color="var(--success)"
        />
        <ResultRow label="최종 수수료" value={`${fmtBp(totals.fee)} BP`} color="var(--danger)" />
        <div style={styles.netBlock}>
          <div style={styles.netLabel}>실수령액</div>
          <div style={styles.netValue}>
            {fmtBp(totals.net)}
            <span style={styles.bpUnit}> BP</span>
          </div>
          <div style={styles.netShort}>{fmtBpShort(totals.net)} BP</div>
        </div>
      </div>

      <p style={styles.footNote}>
        기본 수수료 40%에서 PC방·TOP CLASS·쿠폰 할인이 <b>수수료 기준으로 합산 차감</b>됩니다.
        판매 금액은 억 BP 단위로 입력하세요(예: 1.5 = 1억 5,000만 BP). 계산값은 이 기기에 저장됩니다.
      </p>
    </section>
  );
}

function ToggleRow({ label, on, onToggle, noBorder }) {
  return (
    <div style={{ ...styles.toggleRow, ...(noBorder ? { borderBottom: 'none', padding: 0 } : {}) }}>
      <span style={styles.toggleLabel}>{label}</span>
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={on}
        style={{ ...styles.switch, ...(on ? styles.switchOn : {}) }}
      >
        <span style={{ ...styles.knob, ...(on ? styles.knobOn : {}) }} />
      </button>
    </div>
  );
}

function ResultRow({ label, value, color }) {
  return (
    <div style={styles.resultRow}>
      <span style={styles.resultLabel}>{label}</span>
      <span style={{ ...styles.resultValue, ...(color ? { color } : {}) }}>{value}</span>
    </div>
  );
}

const styles = {
  section: { marginBottom: '28px', wordBreak: 'keep-all' },
  groupTitle: { fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: '4px 0 10px' },
  rowCard: {
    padding: '12px',
    borderRadius: '12px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    marginBottom: '10px',
  },
  rowMain: { display: 'flex', alignItems: 'stretch', gap: '8px' },
  amountWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface-2)',
    padding: '0 10px',
  },
  amountInput: {
    flex: 1,
    minWidth: 0,
    padding: '10px 0',
    fontSize: '16px',
    fontWeight: 700,
    border: 'none',
    background: 'transparent',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  unit: { fontSize: '12px', color: 'var(--text-faint)', marginLeft: '6px', flexShrink: 0 },
  removeBtn: {
    width: '40px',
    fontSize: '20px',
    borderRadius: '8px',
    border: 'none',
    background: 'var(--surface-3)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  rowSub: { display: 'flex', gap: '8px', marginTop: '8px' },
  qtyBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    padding: '2px',
  },
  stepBtn: {
    width: '32px',
    height: '32px',
    fontSize: '18px',
    borderRadius: '6px',
    border: 'none',
    background: 'var(--surface)',
    color: 'var(--text-body)',
    cursor: 'pointer',
  },
  qtyText: {
    minWidth: '40px',
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  couponBox: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    padding: '0 10px',
  },
  couponInput: {
    flex: 1,
    minWidth: 0,
    padding: '8px 0',
    fontSize: '14px',
    border: 'none',
    background: 'transparent',
    textAlign: 'right',
  },
  couponPct: { fontSize: '13px', color: 'var(--text-muted)', marginLeft: '4px' },
  disabledInput: { color: 'var(--text-faint)', opacity: 0.6 },
  rowResult: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '10px',
    paddingTop: '8px',
    borderTop: '1px solid var(--border-subtle)',
    fontSize: '12px',
    color: 'var(--text-muted)',
    fontVariantNumeric: 'tabular-nums',
  },
  rowFee: { color: 'var(--text-faint)' },
  addBtn: {
    width: '100%',
    padding: '13px',
    fontSize: '15px',
    fontWeight: 700,
    borderRadius: '12px',
    border: '1px dashed var(--accent-weak-border)',
    background: 'var(--accent-weak-bg)',
    color: 'var(--accent)',
    cursor: 'pointer',
    marginBottom: '14px',
  },
  totalLine: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 4px',
    fontSize: '14px',
    color: 'var(--text-body)',
    borderTop: '1px solid var(--border)',
    marginBottom: '10px',
  },
  totalGross: { fontSize: '16px', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' },
  card: {
    padding: '6px 16px',
    borderRadius: '14px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    marginBottom: '14px',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 0',
    borderBottom: '1px solid var(--border-subtle)',
  },
  toggleLabel: { fontSize: '14px', color: 'var(--text-body)' },
  switch: {
    width: '46px',
    height: '28px',
    borderRadius: '999px',
    border: 'none',
    background: 'var(--border-strong)',
    cursor: 'pointer',
    padding: 0,
    position: 'relative',
    transition: 'background-color 0.2s ease',
    flexShrink: 0,
  },
  switchOn: { background: 'var(--accent)' },
  knob: {
    position: 'absolute',
    top: '3px',
    left: '3px',
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: '#fff',
    transition: 'left 0.2s ease',
    boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
  },
  knobOn: { left: '21px' },
  bulkRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '14px 0',
  },
  bulkInputWrap: {
    display: 'flex',
    alignItems: 'center',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface-2)',
    padding: '0 10px',
  },
  bulkInput: {
    width: '64px',
    padding: '8px 0',
    fontSize: '15px',
    border: 'none',
    background: 'transparent',
    textAlign: 'right',
  },
  resultCard: {
    padding: '18px',
    borderRadius: '14px',
    background: 'var(--accent-weak-bg)',
    border: '1px solid var(--accent-weak-border)',
    marginBottom: '14px',
  },
  resultRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '7px 0',
  },
  resultLabel: { fontSize: '13px', color: 'var(--text-muted)' },
  resultValue: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-body)',
    fontVariantNumeric: 'tabular-nums',
  },
  netBlock: {
    textAlign: 'center',
    marginTop: '10px',
    paddingTop: '14px',
    borderTop: '1px solid var(--border)',
  },
  netLabel: { fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' },
  netValue: {
    fontSize: 'clamp(24px, 8vw, 34px)',
    fontWeight: 800,
    color: 'var(--text)',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.1,
  },
  bpUnit: { fontSize: '16px', fontWeight: 700, color: 'var(--text-muted)' },
  netShort: { fontSize: '13px', color: 'var(--text-faint)', marginTop: '6px' },
  footNote: { fontSize: '12px', color: 'var(--text-faint)', lineHeight: 1.6 },
};
