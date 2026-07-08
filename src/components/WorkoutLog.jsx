import { useEffect, useMemo, useState } from 'react';
import { DOW_NAMES, pad } from '../utils/workHours';
import { newId } from '../utils/id';
import HealthConnectPanel from './HealthConnectPanel';
import {
  ICON,
  LABEL,
  LOG_KEY,
  PLAN_KEY,
  SHORT,
  displayType,
  flip,
  isDayDone,
  loadLog,
  loadPlan,
  restExerciseId,
  toISO,
} from '../utils/workout';

// 운동 기록: 달력에 날짜별 상체/하체와 체크 상태를 저장합니다.
export default function WorkoutLog() {
  const today = useMemo(() => new Date(), []);
  const todayISO = toISO(today);

  const [plan, setPlan] = useState(loadPlan);
  const [log, setLog] = useState(loadLog);
  const [year, setYear] = useState(today.getFullYear());
  const [monthIndex, setMonthIndex] = useState(today.getMonth());
  const [selected, setSelected] = useState(todayISO);
  const [text, setText] = useState('');

  useEffect(() => {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  }, [plan]);
  useEffect(() => {
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  }, [log]);

  // 달력 셀 구성 (앞쪽 빈칸 + 날짜)
  const cells = useMemo(() => {
    const startDow = new Date(year, monthIndex, 1).getDay();
    const count = new Date(year, monthIndex + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < startDow; i++) arr.push(null);
    for (let d = 1; d <= count; d++) {
      arr.push(`${year}-${pad(monthIndex + 1)}-${pad(d)}`);
    }
    return arr;
  }, [year, monthIndex]);

  function shiftMonth(delta) {
    const d = new Date(year, monthIndex + delta, 1);
    setYear(d.getFullYear());
    setMonthIndex(d.getMonth());
  }

  const selType = displayType(log, selected, plan);
  const selExercises = plan[selType] || [];
  const selRecord = log[selected];
  const selDoneIds = selRecord?.type === selType ? selRecord.doneIds : [];
  const selDone = isDayDone(
    selRecord && selRecord.type === selType ? selRecord : null,
    plan
  );
  // 이번 회차에 쉬어도 되는(추천에서 빠지는) 종목 — 매번 번갈아 바뀝니다.
  const restId = restExerciseId(log, selected, selType, plan);

  function setType(type) {
    // 종목 변경 시 체크 초기화
    setLog((prev) => ({ ...prev, [selected]: { type, doneIds: [] } }));
  }

  function toggleEx(id) {
    setLog((prev) => {
      const rec = prev[selected] || { type: selType, doneIds: [] };
      const doneIds = rec.doneIds.includes(id)
        ? rec.doneIds.filter((x) => x !== id)
        : [...rec.doneIds, id];
      return { ...prev, [selected]: { type: rec.type, doneIds } };
    });
  }

  function addExercise() {
    const t = text.trim();
    if (!t) return;
    setPlan((p) => ({ ...p, [selType]: [...p[selType], { id: newId(), text: t }] }));
    setText('');
  }
  function removeExercise(id) {
    setPlan((p) => ({ ...p, [selType]: p[selType].filter((e) => e.id !== id) }));
  }

  function clearDay() {
    setLog((prev) => {
      const next = { ...prev };
      delete next[selected];
      return next;
    });
  }

  const selDate = new Date(`${selected}T00:00:00`);
  const selLabel = `${selDate.getMonth() + 1}월 ${selDate.getDate()}일 (${DOW_NAMES[selDate.getDay()]})`;

  return (
    <section style={styles.section}>
      {/* 월 이동 */}
      <div style={styles.monthRow}>
        <button style={styles.navBtn} onClick={() => shiftMonth(-1)}>
          ‹
        </button>
        <span style={styles.monthLabel}>
          {year}년 {monthIndex + 1}월
        </span>
        <button style={styles.navBtn} onClick={() => shiftMonth(1)}>
          ›
        </button>
      </div>

      {/* 요일 헤더 */}
      <div style={styles.grid}>
        {DOW_NAMES.map((d, i) => (
          <div
            key={d}
            style={{
              ...styles.dowCell,
              color: i === 0 ? 'var(--danger)' : i === 6 ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div style={styles.grid}>
        {cells.map((iso, i) => {
          if (!iso) return <div key={`b${i}`} />;
          const rec = log[iso];
          const done = isDayDone(rec, plan);
          const isToday = iso === todayISO;
          const isSel = iso === selected;
          const dayNum = Number(iso.slice(8, 10));
          return (
            <button
              key={iso}
              onClick={() => setSelected(iso)}
              style={{
                ...styles.dayCell,
                ...(isSel ? styles.dayCellSel : {}),
                ...(isToday && !isSel ? styles.dayCellToday : {}),
              }}
            >
              <span style={styles.dayNum}>{dayNum}</span>
              {rec ? (
                <span
                  style={{
                    ...styles.badge,
                    background: done ? 'var(--purple)' : 'var(--purple-chip-bg)',
                    color: done ? '#fff' : 'var(--purple)',
                  }}
                >
                  {SHORT[rec.type]}
                </span>
              ) : (
                <span style={styles.badgeEmpty} />
              )}
            </button>
          );
        })}
      </div>

      {/* 선택일 상세 */}
      <div style={styles.detail}>
        <div style={styles.detailHead}>
          <span style={styles.detailDate}>
            {selLabel} {selected === todayISO && <em style={styles.todayTag}>오늘</em>}
          </span>
          {selRecord && (
            <button onClick={clearDay} style={styles.clearBtn}>
              기록 삭제
            </button>
          )}
        </div>

        {/* 종목 선택 */}
        <div style={styles.typeRow}>
          {['upper', 'lower'].map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{
                ...styles.typeBtn,
                ...(selType === t ? styles.typeBtnActive : {}),
              }}
            >
              {ICON[t]} {LABEL[t]}
            </button>
          ))}
        </div>

        <div style={{ ...styles.hint, ...(selDone ? styles.hintDone : {}) }}>
          {selExercises.length === 0
            ? '아래에서 종목을 추가하세요.'
            : selDone
              ? `완료! 다음 운동은 ${LABEL[flip(selType)]} 추천.`
              : `${LABEL[selType]} 운동 · 하나는 쉬어도 완료 (완료 시 다음은 ${LABEL[flip(selType)]} 추천)`}
        </div>

        {/* 종목 체크리스트 */}
        <ul style={styles.list}>
          {selExercises.map((e) => {
            const checked = selDoneIds.includes(e.id);
            const isRest = e.id === restId && !checked;
            return (
              <li key={e.id} style={{ ...styles.item, ...(isRest ? styles.itemRest : {}) }}>
                <label style={styles.check}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleEx(e.id)}
                    style={styles.checkbox}
                  />
                  <span style={{ ...styles.text, ...(checked ? styles.textDone : {}) }}>
                    {e.text}
                  </span>
                  {isRest && <span style={styles.restTag}>오늘 쉬어도 OK</span>}
                </label>
                <button onClick={() => removeExercise(e.id)} style={styles.delBtn}>
                  삭제
                </button>
              </li>
            );
          })}
        </ul>

        <div style={styles.addRow}>
          <input
            type="text"
            value={text}
            placeholder={`${LABEL[selType]} 종목 추가`}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addExercise();
            }}
            style={styles.input}
          />
          <button onClick={addExercise} disabled={!text.trim()} style={styles.addBtn}>
            추가
          </button>
        </div>
      </div>

      {/* 선택한 날짜의 삼성 헬스(Health Connect) 걸음·운동 — 네이티브에서만 표시 */}
      <div style={{ marginTop: '16px' }}>
        <HealthConnectPanel date={selected} isToday={selected === todayISO} />
      </div>

      <p style={styles.footNote}>
        날짜를 눌러 기록을 남기세요. 상체·하체를 번갈아 추천하며(완료 시 다음날 반대 부위),
        하나는 쉬어도 완료로 인정됩니다. 쉬어도 되는 종목은 회차마다 번갈아 바뀝니다.
        필요하면 직접 바꿀 수 있고, 기록은 이 기기에 저장됩니다.
      </p>
    </section>
  );
}

const styles = {
  section: { marginBottom: '28px', wordBreak: 'keep-all' },
  monthRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '18px',
    marginBottom: '12px',
  },
  navBtn: {
    width: '36px',
    height: '36px',
    fontSize: '20px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    cursor: 'pointer',
  },
  monthLabel: { fontSize: '18px', fontWeight: 700, minWidth: '120px', textAlign: 'center' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' },
  dowCell: { textAlign: 'center', fontSize: '12px', padding: '4px 0' },
  dayCell: {
    position: 'relative',
    aspectRatio: '1 / 1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    cursor: 'pointer',
    padding: 0,
  },
  dayCellSel: { border: '2px solid var(--purple)', background: 'var(--purple-weak-bg)' },
  dayCellToday: { border: '1px solid var(--accent-weak-border)', background: 'var(--accent-weak-bg)' },
  dayNum: { fontSize: '13px', color: 'var(--text-body)' },
  badge: {
    fontSize: '11px',
    fontWeight: 700,
    borderRadius: '999px',
    width: '18px',
    height: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmpty: { width: '18px', height: '18px' },
  detail: {
    marginTop: '16px',
    padding: '16px',
    borderRadius: '12px',
    background: 'var(--purple-weak-bg)',
    border: '1px solid var(--purple-border)',
  },
  detailHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
  },
  detailDate: { fontSize: '16px', fontWeight: 700, color: 'var(--text)' },
  todayTag: {
    fontStyle: 'normal',
    fontSize: '11px',
    color: 'var(--accent)',
    background: 'var(--accent-chip-bg)',
    borderRadius: '4px',
    padding: '1px 5px',
    marginLeft: '4px',
  },
  clearBtn: {
    padding: '4px 10px',
    fontSize: '12px',
    borderRadius: '6px',
    border: '1px solid var(--danger-border)',
    background: 'var(--surface)',
    color: 'var(--danger)',
    cursor: 'pointer',
  },
  typeRow: { display: 'flex', gap: '8px', marginBottom: '10px' },
  typeBtn: {
    flex: 1,
    padding: '8px 0',
    fontSize: '14px',
    borderRadius: '8px',
    border: '1px solid var(--purple-border-strong)',
    background: 'var(--surface)',
    color: 'var(--purple)',
    cursor: 'pointer',
  },
  typeBtnActive: {
    background: 'var(--purple)',
    borderColor: 'var(--purple)',
    color: '#fff',
    fontWeight: 700,
  },
  hint: { fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px' },
  hintDone: { color: 'var(--success)', fontWeight: 600 },
  list: { listStyle: 'none', padding: 0, margin: 0 },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 2px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  itemRest: { opacity: 0.6 },
  restTag: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--purple)',
    background: 'var(--purple-bg)',
    borderRadius: '999px',
    padding: '2px 8px',
    whiteSpace: 'nowrap',
  },
  check: { display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer' },
  checkbox: { width: '18px', height: '18px', flexShrink: 0 },
  text: { fontSize: '15px', color: 'var(--text)' },
  textDone: { textDecoration: 'line-through', color: 'var(--text-faint)' },
  delBtn: {
    padding: '4px 10px',
    fontSize: '12px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-faint)',
    cursor: 'pointer',
  },
  addRow: { display: 'flex', gap: '8px', marginTop: '12px' },
  input: {
    flex: 1,
    padding: '9px 12px',
    fontSize: '14px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
  },
  addBtn: {
    padding: '9px 14px',
    fontSize: '14px',
    fontWeight: 600,
    borderRadius: '8px',
    border: 'none',
    background: 'var(--purple)',
    color: '#fff',
    cursor: 'pointer',
  },
  footNote: { marginTop: '14px', fontSize: '12px', color: 'var(--text-faint)', lineHeight: 1.5 },
};
