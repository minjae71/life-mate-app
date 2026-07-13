import { useEffect, useMemo, useState } from 'react';
import {
  addToDate,
  ddayInfo,
  diffDays,
  isoLabelWithDow,
  labelWithDow,
  toISO,
} from '../utils/dateCalc';
import { newId } from '../utils/id';
import { loadJSON } from '../utils/storage';

const ANNIV_KEY = 'datecalc:anniversaries';

function loadAnniversaries() {
  const arr = loadJSON(ANNIV_KEY, null);
  return Array.isArray(arr) ? arr : [];
}

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

  // 기념일
  const [annivs, setAnnivs] = useState(loadAnniversaries);
  const [annivName, setAnnivName] = useState('');
  const [annivDate, setAnnivDate] = useState(today);
  const [annivRepeat, setAnnivRepeat] = useState(false);

  useEffect(() => {
    localStorage.setItem(ANNIV_KEY, JSON.stringify(annivs));
  }, [annivs]);

  function addAnniv() {
    const name = annivName.trim();
    if (!name || !annivDate) return;
    setAnnivs((prev) => [
      { id: newId(), name, date: annivDate, repeat: annivRepeat },
      ...prev,
    ]);
    setAnnivName('');
    setAnnivDate(today);
    setAnnivRepeat(false);
  }
  function removeAnniv(id) {
    setAnnivs((prev) => prev.filter((a) => a.id !== id));
  }

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
        <button
          onClick={() => setTab('anniv')}
          style={{ ...styles.segBtn, ...(tab === 'anniv' ? styles.segBtnActive : {}) }}
        >
          기념일 D-day
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
      ) : tab === 'add' ? (
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
      ) : (
        <>
          {/* 기념일 등록 */}
          <div style={styles.card}>
            <div style={styles.field}>
              <label style={styles.label}>이름</label>
              <input
                type="text"
                value={annivName}
                placeholder="예: 사귄 날, 생일, 시험일"
                onChange={(e) => setAnnivName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addAnniv();
                }}
                style={styles.dateInput}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>날짜</label>
              <input
                type="date"
                value={annivDate}
                onChange={(e) => setAnnivDate(e.target.value)}
                style={styles.dateInput}
              />
            </div>
            <label style={styles.checkRow}>
              <input
                type="checkbox"
                checked={annivRepeat}
                onChange={(e) => setAnnivRepeat(e.target.checked)}
              />
              매년 반복 (생일·기념일 — 다음 기념일까지 표시)
            </label>
            <button
              onClick={addAnniv}
              disabled={!annivName.trim() || !annivDate}
              style={styles.annivAddBtn}
            >
              기념일 등록
            </button>
          </div>

          {/* 기념일 목록 */}
          {annivs.length === 0 ? (
            <div style={styles.annivEmpty}>등록된 기념일이 없습니다. 위에서 추가하세요.</div>
          ) : (
            <ul style={styles.annivList}>
              {annivs.map((a) => {
                const info = ddayInfo(a.date, a.repeat);
                return (
                  <li key={a.id} style={styles.annivCard}>
                    <div style={styles.annivInfo}>
                      <div style={styles.annivName}>
                        {a.name}
                        {a.repeat && <span style={styles.repeatTag}>매년</span>}
                      </div>
                      <div style={styles.annivDate}>{isoLabelWithDow(a.date)}</div>
                    </div>
                    <div style={styles.annivRight}>
                      <div
                        style={{
                          ...styles.dday,
                          ...(info?.dir === 'day'
                            ? styles.ddayToday
                            : info?.dir === 'past'
                              ? styles.ddayPast
                              : styles.ddayFuture),
                        }}
                      >
                        {info?.main ?? '-'}
                      </div>
                      {info?.sub && <div style={styles.ddaySub}>{info.sub}</div>}
                    </div>
                    <button onClick={() => removeAnniv(a.id)} style={styles.annivDel}>
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
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
  annivAddBtn: {
    width: '100%',
    padding: '11px 0',
    fontSize: '14px',
    fontWeight: 700,
    borderRadius: '8px',
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    cursor: 'pointer',
    marginTop: '6px',
  },
  annivEmpty: {
    padding: '28px 16px',
    textAlign: 'center',
    fontSize: '14px',
    color: 'var(--text-muted)',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '14px',
  },
  annivList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' },
  annivCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px',
    borderRadius: '14px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  annivInfo: { flex: 1, minWidth: 0 },
  annivName: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--text)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  repeatTag: {
    fontSize: '10px',
    fontWeight: 700,
    color: 'var(--accent)',
    background: 'var(--accent-chip-bg)',
    borderRadius: '4px',
    padding: '1px 5px',
  },
  annivDate: { fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' },
  annivRight: { textAlign: 'right', minWidth: '68px' },
  dday: { fontSize: '20px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 },
  ddayToday: { color: 'var(--danger)' },
  ddayPast: { color: 'var(--accent)' },
  ddayFuture: { color: 'var(--purple)' },
  ddaySub: { fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' },
  annivDel: {
    width: '28px',
    height: '28px',
    flexShrink: 0,
    fontSize: '18px',
    lineHeight: 1,
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-faint)',
    cursor: 'pointer',
  },
};
