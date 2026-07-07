import { useMemo, useState } from 'react';
import {
  BUILTIN_HOLIDAYS,
  loadCustomHolidays,
  saveCustomHolidays,
} from '../utils/holidays';

// 공휴일 관리: 사용자 지정 공휴일 추가/삭제 + 기본 공휴일 제외(변동 대응)
export default function HolidayManager() {
  const [custom, setCustom] = useState(loadCustomHolidays);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');

  function persist(next) {
    setCustom(next);
    saveCustomHolidays(next);
  }

  function addHoliday() {
    if (!date) return;
    persist({ ...custom, [date]: name.trim() || '휴일' });
    setDate('');
    setName('');
  }

  function removeKey(iso) {
    const next = { ...custom };
    delete next[iso];
    persist(next);
  }

  // 기본 공휴일을 근무일로 되돌리려면 '' 로 오버라이드 (변동/취소 대응)
  function excludeBuiltin(iso) {
    persist({ ...custom, [iso]: '' });
  }

  // 직접 등록(값이 있는 항목)과 제외(값이 '')를 구분
  const added = useMemo(
    () =>
      Object.entries(custom)
        .filter(([, v]) => v)
        .sort(([a], [b]) => a.localeCompare(b)),
    [custom]
  );

  const builtinList = useMemo(
    () => Object.entries(BUILTIN_HOLIDAYS).sort(([a], [b]) => a.localeCompare(b)),
    []
  );

  return (
    <section style={styles.section}>
      {/* 추가 폼 */}
      <div style={styles.addBox}>
        <div style={styles.addTitle}>공휴일 직접 등록</div>
        <div style={styles.addRow}>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={styles.dateInput}
          />
          <input
            type="text"
            placeholder="이름 (예: 창립기념일)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={styles.nameInput}
          />
          <button onClick={addHoliday} disabled={!date} style={styles.addBtn}>
            추가
          </button>
        </div>
      </div>

      {/* 등록한 공휴일 */}
      <h2 style={styles.h2}>등록한 공휴일</h2>
      {added.length === 0 ? (
        <p style={styles.empty}>직접 등록한 공휴일이 없습니다.</p>
      ) : (
        <ul style={styles.list}>
          {added.map(([iso, label]) => (
            <li key={iso} style={styles.item}>
              <span style={styles.itemDate}>{iso}</span>
              <span style={styles.itemName}>{label}</span>
              <button onClick={() => removeKey(iso)} style={styles.delBtn}>
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 기본 공휴일 */}
      <h2 style={styles.h2}>기본 공휴일</h2>
      <p style={styles.hint}>변경/취소된 날은 "제외"하면 근무일로 처리됩니다.</p>
      <ul style={styles.list}>
        {builtinList.map(([iso, label]) => {
          const excluded = custom[iso] === '';
          return (
            <li key={iso} style={styles.item}>
              <span style={styles.itemDate}>{iso}</span>
              <span
                style={{
                  ...styles.itemName,
                  ...(excluded ? styles.itemNameExcluded : {}),
                }}
              >
                {label}
              </span>
              {excluded ? (
                <button onClick={() => removeKey(iso)} style={styles.restoreBtn}>
                  복원
                </button>
              ) : (
                <button onClick={() => excludeBuiltin(iso)} style={styles.delBtn}>
                  제외
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <p style={styles.footNote}>
        등록/제외 내용은 이 기기에 저장되며, 근무시간 계산기에 즉시 반영됩니다.
      </p>
    </section>
  );
}

const styles = {
  section: { marginBottom: '28px' },
  addBox: {
    padding: '14px',
    borderRadius: '12px',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    marginBottom: '20px',
  },
  addTitle: { fontSize: '14px', fontWeight: 600, marginBottom: '10px', color: 'var(--text-body)' },
  addRow: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  dateInput: {
    padding: '8px',
    fontSize: '14px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
  },
  nameInput: {
    flex: 1,
    minWidth: '120px',
    padding: '8px',
    fontSize: '14px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
  },
  addBtn: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 600,
    borderRadius: '8px',
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    cursor: 'pointer',
  },
  h2: { fontSize: '15px', margin: '16px 0 8px' },
  hint: { fontSize: '12px', color: 'var(--text-faint)', margin: '0 0 8px' },
  empty: { fontSize: '14px', color: 'var(--text-faint)', margin: '4px 0' },
  list: { listStyle: 'none', padding: 0, margin: 0 },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 4px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  itemDate: { fontSize: '13px', color: 'var(--text-muted)', width: '96px', flexShrink: 0 },
  itemName: { flex: 1, fontSize: '14px', color: 'var(--text)' },
  itemNameExcluded: { textDecoration: 'line-through', color: 'var(--text-placeholder)' },
  delBtn: {
    padding: '4px 10px',
    fontSize: '12px',
    borderRadius: '6px',
    border: '1px solid var(--danger-border)',
    background: 'var(--surface)',
    color: 'var(--danger)',
    cursor: 'pointer',
  },
  restoreBtn: {
    padding: '4px 10px',
    fontSize: '12px',
    borderRadius: '6px',
    border: '1px solid var(--accent-weak-border)',
    background: 'var(--surface)',
    color: 'var(--accent)',
    cursor: 'pointer',
  },
  footNote: { marginTop: '14px', fontSize: '12px', color: 'var(--text-faint)', lineHeight: 1.5 },
};
