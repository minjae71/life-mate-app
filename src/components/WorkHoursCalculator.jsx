import { useEffect, useMemo, useState } from 'react';
import {
  computeSummary,
  fmtDuration,
  getMonthDays,
  pad,
  toISO,
  workedSeconds,
} from '../utils/workHours';
import { getMergedHolidays } from '../utils/holidays';
import { loadJSON } from '../utils/storage';

const ENTRIES_KEY = 'workhours:entries';
const BREAK_KEY = 'workhours:break';

function loadEntries() {
  return loadJSON(ENTRIES_KEY, {});
}
function loadBreak() {
  const v = Number(localStorage.getItem(BREAK_KEY));
  return Number.isFinite(v) && v >= 0 ? v : 60; // 기본 휴게 60분
}

// 유연근무 근무시간 계산기 (월 단위 정산)
export default function WorkHoursCalculator() {
  const today = useMemo(() => new Date(), []);
  const todayISO = toISO(today);

  const [year, setYear] = useState(today.getFullYear());
  const [monthIndex, setMonthIndex] = useState(today.getMonth());
  const [entries, setEntries] = useState(loadEntries);
  const [breakMinutes, setBreakMinutes] = useState(loadBreak);
  const [modalIso, setModalIso] = useState(null); // 편집 모달을 띄운 날짜(iso)

  useEffect(() => {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  }, [entries]);
  useEffect(() => {
    localStorage.setItem(BREAK_KEY, String(breakMinutes));
  }, [breakMinutes]);

  // 병합 공휴일(내장 + 사용자 등록). 페이지 진입 시 localStorage에서 읽습니다.
  const holidays = useMemo(() => getMergedHolidays(), []);
  const days = useMemo(
    () => getMonthDays(year, monthIndex, holidays),
    [year, monthIndex, holidays]
  );
  const summary = useMemo(
    () => computeSummary(days, entries, breakMinutes, todayISO),
    [days, entries, breakMinutes, todayISO]
  );

  function setEntry(iso, field, value) {
    setEntries((prev) => {
      const cur = { ...(prev[iso] || {}) };
      if (value) cur[field] = value;
      else delete cur[field];
      const nextEntry = { ...cur };
      const out = { ...prev };
      if (nextEntry.start || nextEntry.end) out[iso] = nextEntry;
      else delete out[iso];
      return out;
    });
  }

  function setLeave(iso, checked) {
    setEntries((prev) => {
      const out = { ...prev };
      if (checked) out[iso] = { leave: true }; // 연차: 시간 대신 8시간 자동
      else delete out[iso];
      return out;
    });
  }

  function shiftMonth(delta) {
    const d = new Date(year, monthIndex + delta, 1);
    setYear(d.getFullYear());
    setMonthIndex(d.getMonth());
  }

  const over = summary.remainingSeconds < 0;
  const modalDay = modalIso ? days.find((x) => x.iso === modalIso) : null;

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

      {/* 요약 */}
      <div style={styles.summary}>
        <div style={styles.bigRow}>
          <div style={styles.bigItem}>
            <div style={styles.bigLabel}>{over ? '초과 근무' : '남은 근무'}</div>
            <div style={{ ...styles.bigValue, color: over ? 'var(--success)' : 'var(--accent-strong)' }}>
              {fmtDuration(Math.abs(summary.remainingSeconds))}
            </div>
          </div>
          <div style={styles.bigItem}>
            <div style={styles.bigLabel}>하루 평균 필요</div>
            <div style={styles.bigValue}>
              {summary.avgPerDay == null
                ? over
                  ? '달성 완료'
                  : '-'
                : fmtDuration(summary.avgPerDay)}
            </div>
          </div>
        </div>
        <div style={styles.subGrid}>
          <SubStat label="근무일수" value={`${summary.workdayCount}일`} />
          <SubStat label="총 필요" value={fmtDuration(summary.requiredSeconds)} />
          <SubStat label="근무 완료" value={fmtDuration(summary.workedTotal)} />
          <SubStat label="남은 근무일" value={`${summary.remainingWorkdayCount}일`} />
        </div>
        <label style={styles.breakRow}>
          하루 휴게시간
          <input
            type="number"
            min="0"
            step="10"
            value={breakMinutes}
            onChange={(e) => setBreakMinutes(Math.max(0, Number(e.target.value)))}
            style={styles.breakInput}
          />
          분 (출근~퇴근에서 차감)
        </label>
      </div>

      {/* 달력(일자 목록) */}
      <ul style={styles.dayList}>
        {days.map((d) => {
          const entry = entries[d.iso] || {};
          const isLeave = !!entry.leave;
          const sec = workedSeconds(entry, breakMinutes);
          const isToday = d.iso === todayISO;
          const label = d.holidayName || (d.isWeekend ? '주말' : null);
          const hasAny = !!(entry.start || entry.end);
          return (
            <li
              key={d.iso}
              onClick={d.isWeekend ? undefined : () => setModalIso(d.iso)}
              style={{
                ...styles.dayItem,
                ...(d.isWorkday ? {} : styles.dayItemOff),
                ...(isToday ? styles.dayItemToday : {}),
                ...(d.isWeekend ? {} : styles.dayItemClickable),
              }}
            >
              <div style={styles.dayHead}>
                <span style={{ ...styles.dayNum, color: dowColor(d) }}>
                  {d.day}
                </span>
                <span style={{ ...styles.dowName, color: dowColor(d) }}>
                  {d.dowName}
                </span>
                {isToday && <span style={styles.todayTag}>오늘</span>}
                {label && <span style={styles.offTag}>{label}</span>}
              </div>

              {d.isWeekend ? (
                // 주말: 입력 불가
                <div style={styles.lockedRight}>휴무</div>
              ) : (
                // 요약만 한 줄로 표시, 탭하면 편집 모달
                <div style={styles.rowSummary}>
                  {isLeave ? (
                    <span style={styles.leaveTag}>연차 · 8시간</span>
                  ) : hasAny ? (
                    <>
                      <span style={styles.rangeText}>
                        {hms(entry.start)}~{hms(entry.end)}
                      </span>
                      <span style={styles.workedText}>
                        {sec != null ? fmtDuration(sec) : '입력 중'}
                      </span>
                    </>
                  ) : (
                    <span style={styles.placeholder}>입력하기</span>
                  )}
                  <span style={styles.chevron}>›</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p style={styles.footNote}>
        날짜를 눌러 출·퇴근 시각을 입력하세요. 입력값은 이 기기에 자동 저장됩니다.
        공휴일은 src/data/holidays.js 에서 수정할 수 있어요.
      </p>

      {/* 편집 모달: 행을 탭하면 열립니다. 입력은 즉시 저장됩니다. */}
      {modalDay &&
        (() => {
          const entry = entries[modalDay.iso] || {};
          const isLeave = !!entry.leave;
          const sec = workedSeconds(entry, breakMinutes);
          const close = () => setModalIso(null);
          return (
            <div style={styles.overlay} onClick={close}>
              <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
                <div style={styles.modalHead}>
                  <span style={styles.modalTitle}>
                    {monthIndex + 1}월 {modalDay.day}일 ({modalDay.dowName})
                  </span>
                  <button style={styles.modalClose} onClick={close}>
                    ✕
                  </button>
                </div>

                {modalDay.isWorkday && (
                  <label style={styles.modalLeave}>
                    <input
                      type="checkbox"
                      checked={isLeave}
                      onChange={(e) => setLeave(modalDay.iso, e.target.checked)}
                    />
                    연차 (8시간 자동 인정)
                  </label>
                )}

                {isLeave ? (
                  <div style={styles.modalLeaveTag}>연차 · 8시간</div>
                ) : (
                  <>
                    <div style={styles.modalField}>
                      <span style={styles.modalLabel}>출근</span>
                      <TimeField
                        value={entry.start || ''}
                        onChange={(v) => setEntry(modalDay.iso, 'start', v)}
                        style={styles.modalTimeInput}
                      />
                    </div>
                    <div style={styles.modalField}>
                      <span style={styles.modalLabel}>퇴근</span>
                      <TimeField
                        value={entry.end || ''}
                        onChange={(v) => setEntry(modalDay.iso, 'end', v)}
                        style={styles.modalTimeInput}
                      />
                    </div>
                    <div style={styles.modalTotal}>
                      합계 <strong>{sec != null ? fmtDuration(sec) : '-'}</strong>
                      <span style={styles.modalBreakNote}>
                        {' '}
                        (휴게 {breakMinutes}분 차감)
                      </span>
                    </div>
                  </>
                )}

                <button style={styles.modalDone} onClick={close}>
                  완료
                </button>
              </div>
            </div>
          );
        })()}
    </section>
  );
}

function SubStat({ label, value }) {
  return (
    <div style={styles.subStat}>
      <div style={styles.subLabel}>{label}</div>
      <div style={styles.subValue}>{value}</div>
    </div>
  );
}

// 24시간제 시각 입력 (오전/오후 없음, 초까지). 숫자만 입력하면 자동으로 콜론이 들어갑니다.
// 예) 90000 -> 09:00:00. 저장은 blur 시 "HH:MM:SS"로 정규화됩니다.
function TimeField({ value, onChange, style }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  function handleChange(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
    let out = digits;
    if (digits.length > 4)
      out = `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}:${digits.slice(2)}`;
    setText(out);
  }

  function commit() {
    const norm = normalizeTime(text);
    setText(norm);
    onChange(norm);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="시:분:초"
      value={text}
      onChange={handleChange}
      onBlur={commit}
      style={{ ...styles.timeInput, ...style }}
    />
  );
}

// "HH:MM" | "HH:MM:SS" -> "HH:MM:SS" (요약 표시용, 초 없는 옛 데이터는 :00 보정).
// 비었으면 '--:--:--'.
function hms(t) {
  if (!t) return '--:--:--';
  const [h = '00', m = '00', s = '00'] = t.split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`;
}

// 입력 문자열 -> "HH:MM:SS" (24시간제로 보정). 비었으면 ''.
function normalizeTime(text) {
  const d = (text || '').replace(/\D/g, '');
  if (d.length === 0) return '';
  let h = Number(d.slice(0, 2));
  let m = Number(d.slice(2, 4) || 0);
  let s = Number(d.slice(4, 6) || 0);
  if (Number.isNaN(h)) return '';
  h = Math.min(23, h);
  m = Math.min(59, m);
  s = Math.min(59, s);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// 일요일/공휴일 빨강, 토요일 파랑, 평일 기본
function dowColor(d) {
  if (d.dow === 0 || d.holidayName) return 'var(--danger)';
  if (d.dow === 6) return 'var(--accent)';
  return 'var(--text)';
}

const styles = {
  // wordBreak: 'keep-all' 은 한글이 '33초' → '33 / 초' 처럼 토큰 내부에서
  // 줄바꿈되는 것을 막고 띄어쓰기에서만 줄을 나눕니다. (자식에 상속됨)
  section: { marginBottom: '28px', wordBreak: 'keep-all' },
  monthRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '18px',
    marginBottom: '14px',
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
  summary: {
    padding: '16px',
    borderRadius: '12px',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    marginBottom: '16px',
  },
  bigRow: { display: 'flex', gap: '12px', marginBottom: '14px' },
  bigItem: {
    flex: 1,
    padding: '12px',
    background: 'var(--surface)',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    textAlign: 'center',
  },
  bigLabel: { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' },
  // 좁은 화면에서도 '초'가 밀려나지 않도록 화면 폭에 맞춰 글자 크기 조절
  bigValue: { fontSize: 'clamp(16px, 4.6vw, 20px)', fontWeight: 700, color: 'var(--text)', lineHeight: 1.25 },
  subGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
    marginBottom: '12px',
  },
  subStat: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 10px',
    background: 'var(--surface)',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    fontSize: '13px',
  },
  subLabel: { color: 'var(--text-muted)', whiteSpace: 'nowrap' },
  subValue: { fontWeight: 600, color: 'var(--text-body)', textAlign: 'right' },
  breakRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: 'var(--text-muted)',
  },
  breakInput: {
    width: '64px',
    padding: '4px 6px',
    fontSize: '14px',
    borderRadius: '6px',
    border: '1px solid var(--border-strong)',
    textAlign: 'right',
  },
  dayList: { listStyle: 'none', padding: 0, margin: 0 },
  dayItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  dayItemOff: { background: 'var(--surface-alt)' },
  dayItemToday: { background: 'var(--accent-weak-bg)', borderRadius: '8px' },
  dayHead: { display: 'flex', alignItems: 'center', gap: '4px', width: '84px', flexShrink: 0 },
  dayNum: { fontSize: '15px', fontWeight: 700, minWidth: '22px', textAlign: 'right' },
  dowName: { fontSize: '13px' },
  todayTag: {
    fontSize: '10px',
    color: 'var(--accent)',
    background: 'var(--accent-chip-bg)',
    borderRadius: '4px',
    padding: '1px 4px',
  },
  offTag: { fontSize: '11px', color: 'var(--text-faint)' },
  dayItemClickable: { cursor: 'pointer' },
  rowSummary: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    minWidth: 0,
    justifyContent: 'flex-end',
  },
  // 초까지 넣으면 폭이 늘어난다. 회색 보조정보라 좁은 화면에선 이 항목만
  // 말줄임(…)으로 우선 줄여 근무시간·행 높이(한 줄)를 지킨다.
  rangeText: {
    fontSize: '12px',
    color: 'var(--text-faint)',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
    minWidth: 0,
    flexShrink: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  workedText: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--success)',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
  },
  placeholder: { fontSize: '13px', color: 'var(--text-placeholder)' },
  chevron: { fontSize: '18px', color: 'var(--text-placeholder)', flexShrink: 0, lineHeight: 1 },
  lockedRight: {
    flex: 1,
    textAlign: 'right',
    fontSize: '13px',
    color: 'var(--text-placeholder)',
  },
  leaveTag: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--purple)',
    background: 'var(--purple-bg)',
    borderRadius: '6px',
    padding: '4px 10px',
  },
  timeInput: {
    padding: '5px 2px',
    fontSize: '13px',
    borderRadius: '6px',
    border: '1px solid var(--border-strong)',
    width: '74px',
    textAlign: 'center',
    fontVariantNumeric: 'tabular-nums',
  },
  footNote: { marginTop: '12px', fontSize: '12px', color: 'var(--text-faint)', lineHeight: 1.5 },

  // 편집 모달
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'var(--overlay)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 50,
  },
  modalCard: {
    width: 'min(340px, 100%)',
    background: 'var(--surface)',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 10px 30px var(--shadow-lg)',
    wordBreak: 'keep-all',
  },
  modalHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  modalTitle: { fontSize: '17px', fontWeight: 700, color: 'var(--text)' },
  modalClose: {
    border: 'none',
    background: 'transparent',
    fontSize: '18px',
    color: 'var(--text-faint)',
    cursor: 'pointer',
    padding: '4px',
  },
  modalLeave: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: 'var(--text-body)',
    marginBottom: '14px',
    cursor: 'pointer',
  },
  modalLeaveTag: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--purple)',
    background: 'var(--purple-bg)',
    borderRadius: '10px',
    padding: '12px',
    textAlign: 'center',
    marginBottom: '14px',
  },
  modalField: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  modalLabel: { fontSize: '14px', color: 'var(--text-muted)' },
  modalTimeInput: { width: '140px', fontSize: '16px', padding: '9px 8px' },
  modalTotal: { fontSize: '14px', color: 'var(--text-body)', marginTop: '4px', marginBottom: '16px' },
  modalBreakNote: { fontSize: '12px', color: 'var(--text-faint)' },
  modalDone: {
    width: '100%',
    padding: '12px',
    fontSize: '15px',
    fontWeight: 700,
    borderRadius: '10px',
    border: 'none',
    background: 'var(--accent-strong)',
    color: '#fff',
    cursor: 'pointer',
  },
};
