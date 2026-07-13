import { useEffect, useMemo, useState } from 'react';
import { DOW_NAMES, toISO } from '../utils/workHours';
import { newId } from '../utils/id';
import { loadJSON } from '../utils/storage';

const ITEMS_KEY = 'todos:items';
const CHECKED_KEY = 'todos:checked';
const SECTIONS_KEY = 'todos:sections';

function loadItems() {
  return loadJSON(ITEMS_KEY, []);
}
function loadChecked() {
  return loadJSON(CHECKED_KEY, { date: '', ids: [] });
}
function loadSections() {
  const s = loadJSON(SECTIONS_KEY, null);
  return Array.isArray(s) ? s : null; // null이면 아직 시간대를 만든 적 없음
}

// 최초 로드 시 섹션/항목을 맞춰줍니다.
// - 섹션이 없고 기존 할 일이 있으면 기본 시간대 하나로 옮겨 데이터를 보존
// - sectionId가 없는 항목은 첫 시간대로 보정
function loadInitial() {
  const items = loadItems();
  const sections = loadSections();
  if (!sections) {
    if (items.length > 0) {
      const def = { id: newId(), name: '할 일' };
      return {
        sections: [def],
        items: items.map((i) => ({ ...i, sectionId: i.sectionId || def.id })),
      };
    }
    return { sections: [], items: [] };
  }
  const fallback = sections[0]?.id ?? null;
  return {
    sections,
    items: items.map((i) => (i.sectionId ? i : { ...i, sectionId: fallback })),
  };
}

// 오늘의 할일: 시간대별로 할 일을 나눠 관리합니다.
// 목록은 유지되고 체크 상태는 자정이 지나면 초기화됩니다.
export default function TodoList() {
  const initial = useMemo(loadInitial, []);
  const [sections, setSections] = useState(initial.sections);
  const [items, setItems] = useState(initial.items);
  const [checked, setChecked] = useState(loadChecked); // { date, ids }
  const [today, setToday] = useState(() => toISO(new Date()));
  const [sectionText, setSectionText] = useState('');
  const [drafts, setDrafts] = useState({}); // { [sectionId]: 입력 중인 할 일 }

  // 자정 넘어감 감지: 30초마다 오늘 날짜 확인
  useEffect(() => {
    const timer = setInterval(() => {
      const d = toISO(new Date());
      setToday((prev) => (prev === d ? prev : d));
    }, 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  // 날짜가 바뀌면(자정 경과) 체크 초기화
  useEffect(() => {
    setChecked((prev) => (prev.date === today ? prev : { date: today, ids: [] }));
  }, [today]);

  // 저장
  useEffect(() => {
    localStorage.setItem(SECTIONS_KEY, JSON.stringify(sections));
  }, [sections]);
  useEffect(() => {
    localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
  }, [items]);
  useEffect(() => {
    localStorage.setItem(CHECKED_KEY, JSON.stringify(checked));
  }, [checked]);

  const checkedIds = checked.date === today ? checked.ids : [];
  const doneCount = items.filter((i) => checkedIds.includes(i.id)).length;

  const dateLabel = useMemo(() => {
    const d = new Date(`${today}T00:00:00`);
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW_NAMES[d.getDay()]})`;
  }, [today]);

  // --- 시간대(섹션) 관리 -----------------------------------------------------
  function addSection() {
    const name = sectionText.trim();
    if (!name) return;
    setSections((prev) => [...prev, { id: newId(), name }]);
    setSectionText('');
  }
  function renameSection(id, name) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  }
  function moveSection(id, dir) {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  }
  function removeSection(id) {
    const inSection = items.filter((i) => i.sectionId === id);
    if (
      inSection.length > 0 &&
      !window.confirm(`이 시간대의 할 일 ${inSection.length}개도 함께 삭제됩니다. 계속할까요?`)
    ) {
      return;
    }
    const removeIds = inSection.map((i) => i.id);
    setSections((prev) => prev.filter((s) => s.id !== id));
    setItems((prev) => prev.filter((i) => i.sectionId !== id));
    setChecked((prev) => ({ date: prev.date, ids: prev.ids.filter((x) => !removeIds.includes(x)) }));
  }

  // --- 할 일 관리 -----------------------------------------------------------
  function addTodo(sectionId) {
    const t = (drafts[sectionId] || '').trim();
    if (!t) return;
    setItems((prev) => [...prev, { id: newId(), text: t, sectionId }]);
    setDrafts((prev) => ({ ...prev, [sectionId]: '' }));
  }
  function toggle(id) {
    setChecked((prev) => {
      const base = prev.date === today ? prev.ids : [];
      const ids = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
      return { date: today, ids };
    });
  }
  function removeTodo(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setChecked((prev) => ({ date: prev.date, ids: prev.ids.filter((x) => x !== id) }));
  }

  return (
    <section style={styles.section}>
      <div style={styles.head}>
        <span style={styles.date}>{dateLabel}</span>
        <span style={styles.progress}>
          완료 {doneCount} / {items.length}
        </span>
      </div>

      {/* 시간대 추가 */}
      <div style={styles.addRow}>
        <input
          type="text"
          value={sectionText}
          placeholder="시간대 추가 (예: 기상직후, 아침, 점심)"
          onChange={(e) => setSectionText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addSection();
          }}
          style={styles.input}
        />
        <button onClick={addSection} disabled={!sectionText.trim()} style={styles.addBtn}>
          시간대 추가
        </button>
      </div>

      {sections.length === 0 ? (
        <p style={styles.empty}>
          먼저 시간대를 추가해 보세요. (예: 기상직후, 아침, 오후, 자기 전)
        </p>
      ) : (
        sections.map((section, si) => {
          const secItems = items.filter((i) => i.sectionId === section.id);
          const secDone = secItems.filter((i) => checkedIds.includes(i.id)).length;
          return (
            <div key={section.id} style={styles.sectionCard}>
              <div style={styles.sectionHead}>
                <input
                  type="text"
                  value={section.name}
                  onChange={(e) => renameSection(section.id, e.target.value)}
                  style={styles.sectionName}
                  aria-label="시간대 이름"
                />
                <span style={styles.sectionCount}>
                  {secDone}/{secItems.length}
                </span>
                <button
                  onClick={() => moveSection(section.id, -1)}
                  disabled={si === 0}
                  style={styles.iconBtn}
                  aria-label="위로"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveSection(section.id, 1)}
                  disabled={si === sections.length - 1}
                  style={styles.iconBtn}
                  aria-label="아래로"
                >
                  ↓
                </button>
                <button
                  onClick={() => removeSection(section.id)}
                  style={styles.sectionDelBtn}
                >
                  삭제
                </button>
              </div>

              {secItems.length > 0 && (
                <ul style={styles.list}>
                  {secItems.map((item) => {
                    const done = checkedIds.includes(item.id);
                    return (
                      <li key={item.id} style={styles.item}>
                        <label style={styles.check}>
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={() => toggle(item.id)}
                            style={styles.checkbox}
                          />
                          <span style={{ ...styles.text, ...(done ? styles.textDone : {}) }}>
                            {item.text}
                          </span>
                        </label>
                        <button onClick={() => removeTodo(item.id)} style={styles.delBtn}>
                          삭제
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div style={styles.todoAddRow}>
                <input
                  type="text"
                  value={drafts[section.id] || ''}
                  placeholder="할 일 입력"
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [section.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addTodo(section.id);
                  }}
                  style={styles.todoInput}
                />
                <button
                  onClick={() => addTodo(section.id)}
                  disabled={!(drafts[section.id] || '').trim()}
                  style={styles.todoAddBtn}
                >
                  추가
                </button>
              </div>
            </div>
          );
        })
      )}

      <p style={styles.footNote}>
        시간대를 추가하고 그 아래에 할 일을 넣어보세요. 시간대 이름은 바로 수정할 수 있고,
        ↑↓로 순서를 바꿀 수 있습니다. 체크 상태는 자정(00시)이 지나면 자동으로 초기화되며,
        목록은 유지됩니다.
      </p>
    </section>
  );
}

const styles = {
  section: { marginBottom: '28px', wordBreak: 'keep-all' },
  head: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: '14px',
  },
  date: { fontSize: '18px', fontWeight: 700, color: 'var(--text)' },
  progress: { fontSize: '13px', color: 'var(--text-muted)' },
  addRow: { display: 'flex', gap: '8px', marginBottom: '16px' },
  input: {
    flex: 1,
    padding: '10px 12px',
    fontSize: '15px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
  },
  addBtn: {
    padding: '10px 16px',
    fontSize: '15px',
    fontWeight: 600,
    borderRadius: '8px',
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  empty: { color: 'var(--text-faint)', fontSize: '14px', lineHeight: 1.6 },
  sectionCard: {
    marginBottom: '14px',
    padding: '12px 14px',
    borderRadius: '12px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '6px',
  },
  sectionName: {
    flex: 1,
    minWidth: 0,
    fontSize: '16px',
    fontWeight: 700,
    color: 'var(--text)',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '6px',
    padding: '4px 6px',
  },
  sectionCount: { fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' },
  iconBtn: {
    width: '28px',
    height: '28px',
    fontSize: '14px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-body)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  sectionDelBtn: {
    padding: '4px 10px',
    fontSize: '12px',
    borderRadius: '6px',
    border: '1px solid var(--danger-border)',
    background: 'var(--surface)',
    color: 'var(--danger)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  list: { listStyle: 'none', padding: 0, margin: '0 0 8px' },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 4px',
    borderBottom: '1px solid var(--border-subtle)',
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
  todoAddRow: { display: 'flex', gap: '8px' },
  todoInput: {
    flex: 1,
    padding: '8px 10px',
    fontSize: '14px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
  },
  todoAddBtn: {
    padding: '8px 14px',
    fontSize: '14px',
    fontWeight: 600,
    borderRadius: '8px',
    border: '1px solid var(--accent-weak-border)',
    background: 'var(--accent-weak-bg)',
    color: 'var(--accent)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  footNote: { marginTop: '14px', fontSize: '12px', color: 'var(--text-faint)', lineHeight: 1.5 },
};
