import { useMemo, useState } from 'react';
import { addToDate, diffDays, labelWithDow, toISO } from '../utils/dateCalc';

const UNITS = [
  { id: 'day', label: '일' },
  { id: 'week', label: '주' },
  { id: 'month', label: '개월' },
  { id: 'year', label: '년' },
];

// 날짜 계산기: (1) 두 날짜 사이 일수 (2) 기준일 ± 기간
export default function DateCalculator() {
  const today = useMemo(() => toISO(new Date()), []);
  const [tab, setTab] = useState('diff'); // 'diff' | 'add'

  // 날짜 간격
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [includeStart, setIncludeStart] = useState(false);

  const rawDiff = diffDays(start, end);
  const days = rawDiff == null ? null : Math.abs(rawDiff) + (includeStart ? 1 : 0);
  const weeks = days == null ? null : { w: Math.floor(days / 7), d: days % 7 };

  // 날짜 더하기/빼기
  const [base, setBase] = useState(today);
  const [amount, setAmount] = useState(100);
  const [unit, setUnit] = useState('day');
  const [dir, setDir] = useState(1); // 1: 후, -1: 전

  const resultDate = addToDate(base, amount * dir, unit);

  return (
    <section style={styles.section}>
      <div style={styles.segmented}>
        <button
          onClick={() => setTab('diff')}
          style={{ ...styles.segBtn, ...(tab === 'diff' ? styles.segBtnActive : {}) }}
        >
          날짜 간격
        </button>
        <button
          onClick={() => setTab('add')}
          style={{ ...styles.segBtn, ...(tab === 'add' ? styles.segBtnActive : {}) }}
        >
          날짜 더하기/빼기
        </button>
      </div>

      {tab === 'diff' ? (
        <>
          <div style={styles.card}>
            <div style={styles.field}>
              <label style={styles.label}>시작일</label>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={styles.dateInput} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>종료일</label>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={styles.dateInput} />
            </div>
            <label style={styles.checkRow}>
              <input
                type="checkbox"
                checked={includeStart}
                onChange={(e) => setIncludeStart(e.target.checked)}
              />
              시작일 포함 (양 끝 모두 포함해 세기)
            </label>
          </div>

          <div style={styles.resultCard}>
            <div style={styles.resultLabel}>두 날짜 사이</div>
            <div style={styles.resultBig}>
              {days == null ? '-' : `${days.toLocaleString('ko-KR')}일`}
            </div>
            {weeks && (days >= 7) && (
              <div style={styles.resultSub}>
                {weeks.w}주{weeks.d ? ` ${weeks.d}일` : ''}
              </div>
            )}
            {rawDiff != null && rawDiff < 0 && (
              <div style={styles.note}>※ 종료일이 시작일보다 빠릅니다 (일수는 절댓값)</div>
            )}
          </div>
        </>
      ) : (
        <>
          <div style={styles.card}>
            <div style={styles.field}>
              <label style={styles.label}>기준일</label>
              <input type="date" value={base} onChange={(e) => setBase(e.target.value)} style={styles.dateInput} />
            </div>

            <div style={styles.dirRow}>
              <button
                onClick={() => setDir(1)}
                style={{ ...styles.dirBtn, ...(dir === 1 ? styles.dirActive : {}) }}
              >
                이후 (+)
              </button>
              <button
                onClick={() => setDir(-1)}
                style={{ ...styles.dirBtn, ...(dir === -1 ? styles.dirActive : {}) }}
              >
                이전 (−)
              </button>
            </div>

            <div style={styles.amountRow}>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                style={styles.amountInput}
              />
              <div style={styles.unitRow}>
                {UNITS.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setUnit(u.id)}
                    style={{ ...styles.unitBtn, ...(unit === u.id ? styles.unitActive : {}) }}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={styles.resultCard}>
            <div style={styles.resultLabel}>
              기준일 {dir === 1 ? '이후' : '이전'} {amount}
              {UNITS.find((u) => u.id === unit)?.label}
            </div>
            <div style={styles.resultBig}>{labelWithDow(resultDate)}</div>
          </div>
        </>
      )}
    </section>
  );
}

const styles = {
  section: { marginBottom: '28px' },
  segmented: {
    display: 'flex',
    gap: '6px',
    padding: '4px',
    borderRadius: '10px',
    background: 'var(--surface-3)',
    marginBottom: '14px',
  },
  segBtn: {
    flex: 1,
    padding: '9px 0',
    fontSize: '13px',
    fontWeight: 600,
    borderRadius: '8px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  segBtnActive: {
    background: 'var(--surface)',
    color: 'var(--accent)',
    boxShadow: '0 1px 3px var(--shadow)',
  },
  card: {
    padding: '16px',
    borderRadius: '14px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    marginBottom: '14px',
  },
  field: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    marginBottom: '12px',
  },
  label: { fontSize: '14px', fontWeight: 600, color: 'var(--text-body)' },
  dateInput: {
    flex: 1,
    maxWidth: '62%',
    padding: '9px 10px',
    fontSize: '15px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface-2)',
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    marginTop: '4px',
  },
  dirRow: { display: 'flex', gap: '8px', marginBottom: '12px' },
  dirBtn: {
    flex: 1,
    padding: '10px 0',
    fontSize: '14px',
    fontWeight: 600,
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  dirActive: { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' },
  amountRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  amountInput: {
    width: '90px',
    padding: '10px',
    fontSize: '17px',
    fontWeight: 700,
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface-2)',
    textAlign: 'right',
  },
  unitRow: { display: 'flex', gap: '6px', flex: 1 },
  unitBtn: {
    flex: 1,
    padding: '10px 0',
    fontSize: '14px',
    fontWeight: 600,
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  unitActive: { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' },
  resultCard: {
    padding: '20px',
    borderRadius: '14px',
    background: 'var(--accent-weak-bg)',
    border: '1px solid var(--accent-weak-border)',
    textAlign: 'center',
  },
  resultLabel: { fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' },
  resultBig: {
    fontSize: 'clamp(20px, 6vw, 26px)',
    fontWeight: 800,
    color: 'var(--text)',
    fontVariantNumeric: 'tabular-nums',
  },
  resultSub: { fontSize: '14px', color: 'var(--text-muted)', marginTop: '6px' },
  note: { fontSize: '12px', color: 'var(--text-faint)', marginTop: '10px' },
};
