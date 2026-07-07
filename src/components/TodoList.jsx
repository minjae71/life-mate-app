import { useEffect, useMemo, useState } from 'react';
import { DOW_NAMES, toISO } from '../utils/workHours';
import { newId } from '../utils/id';

const ITEMS_KEY = 'todos:items';
const CHECKED_KEY = 'todos:checked';

function loadItems() {
  try {
    return JSON.parse(localStorage.getItem(ITEMS_KEY)) || [];
  } catch {
    return [];
  }
}
function loadChecked() {
  try {
    return JSON.parse(localStorage.getItem(CHECKED_KEY)) || { date: '', ids: [] };
  } catch {
    return { date: '', ids: [] };
  }
}

// 오늘의 할일: 목록은 유지되고 체크 상태는 자정이 지나면 초기화됩니다.
export default function TodoList() {
  const [items, setItems] = useState(loadItems);
  const [checked, setChecked] = useState(loadChecked); // { date, ids }
  const [today, setToday] = useState(() => toISO(new Date()));
  const [text, setText] = useState('');

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

  function addTodo() {
    const t = text.trim();
    if (!t) return;
    setItems((prev) => [...prev, { id: newId(), text: t }]);
    setText('');
  }

  function toggle(id) {
    setChecked((prev) => {
      const base = prev.date === today ? prev.ids : [];
      const ids = base.includes(id)
        ? base.filter((x) => x !== id)
        : [...base, id];
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

      <div style={styles.addRow}>
        <input
          type="text"
          value={text}
          placeholder="할 일을 입력하세요"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addTodo();
          }}
          style={styles.input}
        />
        <button onClick={addTodo} disabled={!text.trim()} style={styles.addBtn}>
          추가
        </button>
      </div>

      {items.length === 0 ? (
        <p style={styles.empty}>할 일을 추가해 보세요.</p>
      ) : (
        <ul style={styles.list}>
          {items.map((item) => {
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

      <p style={styles.footNote}>
        체크 상태는 자정(00시)이 지나면 자동으로 초기화됩니다. 할 일 목록은 유지됩니다.
      </p>
    </section>
  );
}

const styles = {
  section: { marginBottom: '28px' },
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
  },
  empty: { color: 'var(--text-faint)', fontSize: '14px' },
  list: { listStyle: 'none', padding: 0, margin: 0 },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 4px',
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
  footNote: { marginTop: '14px', fontSize: '12px', color: 'var(--text-faint)', lineHeight: 1.5 },
};
