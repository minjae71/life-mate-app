// 메인 페이지: 로고 헤더 + 설정(⚙️) 진입 + 기능 메뉴 카드 목록.
// 카드 순서는 사용자가 '순서 변경' 모드에서 손잡이(≡)를 끌어 바꿀 수 있고,
// localStorage에 저장됩니다. 터치 기기(안드로이드)에서도 동작하도록 HTML5 드래그가
// 아니라 Pointer Events 로 구현했습니다.
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadJSON, saveJSON } from '../utils/storage';

// 기능별 아이콘 원의 강조색 (반투명이라 라이트/다크 모두 자연스럽게 얹힙니다)
const ACCENTS = {
  todo: '#059669',
  workout: '#7c3aed',
  gtx: '#2563eb',
  work: '#d97706',
  holidays: '#dc2626',
  maplemvp: '#ea580c',
  fconline: '#0ea5e9',
  datecalc: '#0891b2',
  loan: '#16a34a',
  insta: '#d62976',
  lotto: '#9333ea',
};

const ORDER_KEY = 'home:menuOrder';

function loadOrderIds() {
  const arr = loadJSON(ORDER_KEY, null);
  return Array.isArray(arr) ? arr : [];
}
function saveOrderIds(ids) {
  saveJSON(ORDER_KEY, ids);
}

// 저장된 순서를 현재 메뉴에 적용. 저장에 없는(새로 추가된) 기능은 원래 순서로 뒤에 붙이고,
// 사라진 기능 id는 무시한다.
function orderedList(menus, savedIds) {
  const byId = new Map(menus.map((m) => [m.id, m]));
  const result = [];
  for (const id of savedIds) {
    if (byId.has(id)) {
      result.push(byId.get(id));
      byId.delete(id);
    }
  }
  for (const m of menus) if (byId.has(m.id)) result.push(m);
  return result;
}

export default function HomePage({ menus, onSelect, onOpenSettings }) {
  const [editing, setEditing] = useState(false);
  const [orderIds, setOrderIds] = useState(() => loadOrderIds());
  const [draggingId, setDraggingId] = useState(null);
  const dragIdx = useRef(-1);
  const itemRefs = useRef({});

  const orderedMenus = useMemo(() => orderedList(menus, orderIds), [menus, orderIds]);

  // 메뉴 구성이 바뀌면(기능 추가/삭제) 저장 순서를 정규화해 둔다.
  useEffect(() => {
    const normalized = orderedList(menus, orderIds).map((m) => m.id);
    if (normalized.join(',') !== orderIds.join(',')) setOrderIds(normalized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menus]);

  function commitOrder(ids) {
    setOrderIds(ids);
    saveOrderIds(ids);
  }

  function resetOrder() {
    const ids = menus.map((m) => m.id);
    commitOrder(ids);
  }

  // ---- 드래그(포인터) ----
  function onHandleDown(e, index) {
    if (!editing) return;
    e.preventDefault();
    dragIdx.current = index;
    setDraggingId(orderedMenus[index]?.id ?? null);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }

  function onHandleMove(e) {
    if (dragIdx.current < 0) return;
    const y = e.clientY;
    const items = orderedMenus.map((m) => itemRefs.current[m.id]).filter(Boolean);
    let target = items.length - 1;
    for (let i = 0; i < items.length; i++) {
      const r = items[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) {
        target = i;
        break;
      }
    }
    if (target !== dragIdx.current) {
      const ids = orderedMenus.map((m) => m.id);
      const [moved] = ids.splice(dragIdx.current, 1);
      ids.splice(target, 0, moved);
      dragIdx.current = target;
      setOrderIds(ids); // 저장은 손을 뗄 때(onHandleUp)
    }
  }

  function onHandleUp(e) {
    if (dragIdx.current < 0) return;
    dragIdx.current = -1;
    setDraggingId(null);
    saveOrderIds(orderedMenus.map((m) => m.id));
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }

  return (
    <div>
      <header style={styles.topBar}>
        <div style={styles.brand}>
          <span style={styles.logoMark}>
            <svg width="22" height="22" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="30" cy="30" r="23" stroke="#fff" strokeWidth="4" strokeOpacity="0.6" />
              <path d="M30 16 V30 L39 35" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span style={styles.brandName}>LifeMate</span>
        </div>
        <button style={styles.gearBtn} onClick={onOpenSettings} aria-label="설정" disabled={editing}>
          ⚙️
        </button>
      </header>

      <div style={styles.greetingRow}>
        <p style={styles.greeting}>{editing ? '손잡이(≡)를 끌어 순서를 바꾸세요' : '무엇을 관리할까요?'}</p>
        <div style={styles.editControls}>
          {editing && (
            <button style={styles.resetBtn} onClick={resetOrder}>
              기본 순서
            </button>
          )}
          <button
            style={editing ? styles.doneBtn : styles.editBtn}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? '완료' : '순서 변경'}
          </button>
        </div>
      </div>

      <ul style={styles.list}>
        {orderedMenus.map((m, index) => {
          const dragging = draggingId === m.id;
          return (
            <li
              key={m.id}
              ref={(el) => {
                if (el) itemRefs.current[m.id] = el;
                else delete itemRefs.current[m.id];
              }}
            >
              <div
                style={{
                  ...styles.card,
                  ...(editing ? styles.cardEditing : {}),
                  ...(dragging ? styles.cardDragging : {}),
                  cursor: editing ? 'default' : 'pointer',
                }}
                onClick={editing ? undefined : () => onSelect(m.id)}
                role={editing ? undefined : 'button'}
              >
                <span
                  style={{
                    ...styles.iconWrap,
                    background: `${ACCENTS[m.id] || '#2563eb'}22`,
                  }}
                >
                  <span style={styles.icon}>{m.icon}</span>
                </span>
                <span style={styles.textBox}>
                  <span style={styles.cardTitle}>{m.title}</span>
                  <span style={styles.cardDesc}>{m.desc}</span>
                </span>
                {editing ? (
                  <span
                    style={styles.handle}
                    onPointerDown={(e) => onHandleDown(e, index)}
                    onPointerMove={onHandleMove}
                    onPointerUp={onHandleUp}
                    onPointerCancel={onHandleUp}
                    aria-label="드래그해서 순서 변경"
                    role="button"
                  >
                    ≡
                  </span>
                ) : (
                  <span style={styles.chevron}>›</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const styles = {
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  brand: { display: 'flex', alignItems: 'center', gap: '10px' },
  logoMark: {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    background: 'linear-gradient(150deg, var(--brand-grad-a), var(--brand-grad-b))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 10px var(--shadow)',
  },
  brandName: { fontSize: '22px', fontWeight: 800, color: 'var(--text)', letterSpacing: '0.2px' },
  gearBtn: {
    width: '40px',
    height: '40px',
    fontSize: '20px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    margin: '0 0 20px',
  },
  greeting: { color: 'var(--text-muted)', fontSize: '14px', margin: 0, flex: 1, minWidth: 0 },
  editControls: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 },
  editBtn: {
    fontSize: '13px',
    fontWeight: 600,
    padding: '7px 12px',
    borderRadius: '9px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text-body)',
    cursor: 'pointer',
  },
  doneBtn: {
    fontSize: '13px',
    fontWeight: 700,
    padding: '7px 14px',
    borderRadius: '9px',
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    cursor: 'pointer',
  },
  resetBtn: {
    fontSize: '13px',
    fontWeight: 600,
    padding: '7px 10px',
    borderRadius: '9px',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '12px' },
  card: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '16px',
    borderRadius: '14px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    boxShadow: '0 1px 3px var(--shadow)',
    textAlign: 'left',
    boxSizing: 'border-box',
  },
  cardEditing: { borderStyle: 'dashed', borderColor: 'var(--border-strong)' },
  cardDragging: {
    borderColor: 'var(--accent)',
    borderStyle: 'solid',
    boxShadow: '0 8px 20px var(--shadow)',
    transform: 'scale(1.02)',
    opacity: 0.97,
  },
  iconWrap: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  icon: { fontSize: '24px', lineHeight: 1 },
  textBox: { display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 },
  cardTitle: { fontSize: '16px', fontWeight: 600, color: 'var(--text)' },
  cardDesc: { fontSize: '13px', color: 'var(--text-muted)' },
  chevron: { fontSize: '22px', color: 'var(--text-faint)', flexShrink: 0 },
  handle: {
    fontSize: '22px',
    color: 'var(--text-muted)',
    flexShrink: 0,
    padding: '4px 8px',
    cursor: 'grab',
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
};
