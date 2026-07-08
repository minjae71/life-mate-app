import { useEffect, useMemo, useState } from 'react';
import {
  ABILITY_CATEGORIES,
  COACH_STARS,
  ENHANCE_LEVELS,
  FORMATIONS,
  MAX_FOCUS,
  formationById,
  groupAbilities,
  loadAbilities,
  loadTraining,
  orderForFormation,
  rowsForFormation,
  saveAbilities,
  saveTraining,
  toggleFocus,
} from '../utils/fcTraining';

// FC온라인 훈련 관리: 포메이션 선택 → 포지션별 선수/코치/등급 입력 + 행별 집중훈련.
export default function FcTraining() {
  const initial = useMemo(loadTraining, []);
  const [selectedFormation, setSelectedFormation] = useState(initial.selectedFormation);
  const [byFormation, setByFormation] = useState(initial.byFormation);
  const [orderByFormation, setOrderByFormation] = useState(initial.orderByFormation || {});
  const [abilities, setAbilities] = useState(loadAbilities);
  const [openRow, setOpenRow] = useState(null); // 집중훈련 편집 중인 행 index
  const [editingAbilities, setEditingAbilities] = useState(false);

  const formation = formationById(selectedFormation);
  const rows = useMemo(
    () => rowsForFormation({ selectedFormation, byFormation }, selectedFormation),
    [selectedFormation, byFormation]
  );
  // 표시 순서(포지션 index 배열). 커스텀 순서 없으면 기본(ST가 위).
  const order = useMemo(
    () => orderForFormation({ orderByFormation }, selectedFormation),
    [orderByFormation, selectedFormation]
  );

  useEffect(() => {
    saveTraining({ selectedFormation, byFormation, orderByFormation });
  }, [selectedFormation, byFormation, orderByFormation]);

  // 포지션 표시 순서를 역순으로 뒤집기(예: GK가 맨 위였으면 맨 아래로).
  function reverseOrder() {
    setOrderByFormation((prev) => ({ ...prev, [selectedFormation]: [...order].reverse() }));
  }

  const abilityById = useMemo(() => {
    const m = new Map();
    for (const a of abilities) m.set(a.id, a);
    return m;
  }, [abilities]);

  function updateRow(index, patch) {
    setByFormation((prev) => {
      const current = rowsForFormation({ selectedFormation, byFormation: prev }, selectedFormation);
      const next = current.map((r, i) => (i === index ? { ...r, ...patch } : r));
      return { ...prev, [selectedFormation]: next };
    });
  }

  function onToggleFocus(index, abilityId, plus) {
    const row = rows[index];
    updateRow(index, { focus: toggleFocus(row.focus, abilityId, plus) });
  }

  function selectFormation(id) {
    setSelectedFormation(id);
    setOpenRow(null);
  }

  return (
    <section style={styles.section}>
      {/* 포메이션 선택 */}
      <div style={styles.label}>포메이션</div>
      <div style={styles.formRow}>
        {FORMATIONS.map((f) => (
          <button
            key={f.id}
            onClick={() => selectFormation(f.id)}
            style={{ ...styles.formBtn, ...(selectedFormation === f.id ? styles.formBtnActive : {}) }}
          >
            {f.name}
          </button>
        ))}
      </div>

      {/* 포지션 순서 뒤집기 */}
      <div style={styles.orderRow}>
        <span style={styles.orderHint}>포지션 순서 · {formation.name}</span>
        <button style={styles.orderBtn} onClick={reverseOrder}>
          ↕ 순서 뒤집기
        </button>
      </div>

      <ul style={styles.list}>
        {order.map((i) => {
          const pos = formation.positions[i];
          const row = rows[i];
          const isOpen = openRow === i;
          return (
            <li key={`${selectedFormation}-${i}`} style={styles.rowCard}>
              <div style={styles.rowTop}>
                <span style={styles.pos}>{pos}</span>
                <input
                  style={styles.nameInput}
                  placeholder="선수명"
                  value={row.name}
                  onChange={(e) => updateRow(i, { name: e.target.value })}
                />
              </div>

              <div style={styles.fieldRow}>
                <label style={styles.field}>
                  <span style={styles.fieldLabel}>오버롤</span>
                  <input
                    style={styles.numInput}
                    type="number"
                    inputMode="numeric"
                    placeholder="OVR"
                    value={row.overall}
                    onChange={(e) => updateRow(i, { overall: e.target.value })}
                  />
                </label>
                <label style={styles.field}>
                  <span style={styles.fieldLabel}>강화</span>
                  <select
                    style={styles.select}
                    value={row.enhance}
                    onChange={(e) => updateRow(i, { enhance: e.target.value })}
                  >
                    <option value="">-</option>
                    {ENHANCE_LEVELS.map((n) => (
                      <option key={n} value={n}>
                        +{n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={styles.fieldRow}>
                <label style={{ ...styles.field, flex: 2 }}>
                  <span style={styles.fieldLabel}>훈련 코치</span>
                  <input
                    style={styles.coachInput}
                    placeholder="훈련코치명"
                    value={row.coachName}
                    onChange={(e) => updateRow(i, { coachName: e.target.value })}
                  />
                </label>
                <label style={styles.field}>
                  <span style={styles.fieldLabel}>등급</span>
                  <select
                    style={styles.select}
                    value={row.coachGrade}
                    onChange={(e) => updateRow(i, { coachGrade: e.target.value })}
                  >
                    <option value="">-</option>
                    {COACH_STARS.map((n) => (
                      <option key={n} value={n}>
                        ★ {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* 집중훈련 요약/펼치기 */}
              <button
                style={styles.focusToggle}
                onClick={() => setOpenRow(isOpen ? null : i)}
              >
                <span>
                  집중훈련 <b style={styles.focusCount}>{row.focus.length}/{MAX_FOCUS}</b>
                </span>
                <span>{isOpen ? '▲' : '▼'}</span>
              </button>

              {row.focus.length > 0 && !isOpen && (
                <div style={styles.focusChips}>
                  {row.focus.map((f) => {
                    const a = abilityById.get(f.abilityId);
                    return (
                      <span key={f.abilityId} style={styles.chip}>
                        {a ? a.name : '삭제된 능력'} <b>+{f.plus}</b>
                      </span>
                    );
                  })}
                </div>
              )}

              {isOpen && (
                <FocusEditor
                  abilities={abilities}
                  focus={row.focus}
                  onToggle={(abilityId, plus) => onToggleFocus(i, abilityId, plus)}
                />
              )}
            </li>
          );
        })}
      </ul>

      {/* 능력치 목록 편집 */}
      <button style={styles.abEditToggle} onClick={() => setEditingAbilities((v) => !v)}>
        {editingAbilities ? '▲ 능력치 목록 편집 닫기' : '▼ 집중훈련 능력치 목록 편집'}
      </button>
      {editingAbilities && (
        <AbilityEditor
          abilities={abilities}
          onChange={(next) => {
            setAbilities(next);
            saveAbilities(next);
          }}
        />
      )}

      <p style={styles.footNote}>
        포메이션별로 선수·훈련코치·등급을 기록하고, 각 선수의 집중훈련(능력 최대 {MAX_FOCUS}개, 각
        +1~+2)을 관리합니다. 능력치 목록은 직접 편집할 수 있고, 모든 기록은 이 기기에 저장됩니다.
      </p>
    </section>
  );
}

function FocusEditor({ abilities, focus, onToggle }) {
  const groups = useMemo(() => groupAbilities(abilities), [abilities]);
  const full = focus.length >= MAX_FOCUS;
  const selectedOf = (id) => focus.find((f) => f.abilityId === id);

  return (
    <div style={styles.focusEditor}>
      <div style={styles.focusHint}>
        올릴 능력을 최대 {MAX_FOCUS}개 선택하세요. 각 능력에 +1 또는 +2. ({focus.length}/{MAX_FOCUS})
      </div>
      {groups.map(([category, list]) => (
        <div key={category} style={styles.abGroup}>
          <div style={styles.abCategory}>{category}</div>
          {list.map((a) => {
            const sel = selectedOf(a.id);
            return (
              <div key={a.id} style={styles.abRow}>
                <span style={styles.abName}>{a.name}</span>
                <div style={styles.plusBtns}>
                  {[1, 2].map((p) => {
                    const active = sel?.plus === p;
                    const disabled = !sel && full; // 미선택인데 5개 꽉 참
                    return (
                      <button
                        key={p}
                        onClick={() => onToggle(a.id, p)}
                        disabled={disabled}
                        style={{
                          ...styles.plusBtn,
                          ...(active ? styles.plusBtnActive : {}),
                          ...(disabled ? styles.plusBtnDisabled : {}),
                        }}
                      >
                        +{p}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function AbilityEditor({ abilities, onChange }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState(ABILITY_CATEGORIES[0]);

  function add() {
    const n = name.trim();
    if (!n) return;
    const id = `u${Date.now()}`;
    onChange([...abilities, { id, category: category.trim() || '기타', name: n }]);
    setName('');
  }
  function remove(id) {
    onChange(abilities.filter((a) => a.id !== id));
  }

  return (
    <div style={styles.abEditor}>
      <div style={styles.abAddRow}>
        <input
          style={styles.abCatInput}
          list="fc-ab-cats"
          placeholder="분류"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <datalist id="fc-ab-cats">
          {ABILITY_CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <input
          style={styles.abNameInput}
          placeholder="능력치 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button style={styles.abAddBtn} onClick={add} disabled={!name.trim()}>
          추가
        </button>
      </div>
      <ul style={styles.abList}>
        {abilities.map((a) => (
          <li key={a.id} style={styles.abListItem}>
            <span>
              <span style={styles.abListCat}>{a.category}</span> {a.name}
            </span>
            <button style={styles.abDel} onClick={() => remove(a.id)}>
              삭제
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const styles = {
  section: { marginBottom: '28px', wordBreak: 'keep-all' },
  label: { fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' },
  formRow: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' },
  formBtn: {
    padding: '8px 12px',
    fontSize: '13px',
    fontWeight: 600,
    borderRadius: '999px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  formBtnActive: { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-chip-bg)' },
  orderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    marginBottom: '10px',
  },
  orderHint: { fontSize: '12px', color: 'var(--text-muted)', flex: 1, minWidth: 0 },
  orderBtn: {
    fontSize: '13px',
    fontWeight: 600,
    padding: '7px 12px',
    borderRadius: '9px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text-body)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '10px' },
  rowCard: {
    padding: '12px',
    borderRadius: '12px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  rowTop: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' },
  pos: {
    minWidth: '42px',
    textAlign: 'center',
    fontSize: '12px',
    fontWeight: 800,
    color: 'var(--accent)',
    background: 'var(--accent-chip-bg)',
    borderRadius: '8px',
    padding: '6px 4px',
    flexShrink: 0,
  },
  nameInput: {
    flex: 1,
    minWidth: 0,
    padding: '9px 10px',
    fontSize: '15px',
    fontWeight: 600,
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
  },
  fieldRow: { display: 'flex', gap: '8px', marginBottom: '8px' },
  field: { flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
  fieldLabel: { fontSize: '11px', color: 'var(--text-muted)' },
  numInput: {
    padding: '8px 10px',
    fontSize: '14px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    width: '100%',
    boxSizing: 'border-box',
  },
  select: {
    padding: '8px 10px',
    fontSize: '14px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    width: '100%',
    boxSizing: 'border-box',
  },
  coachInput: {
    padding: '8px 10px',
    fontSize: '14px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    width: '100%',
    boxSizing: 'border-box',
  },
  focusToggle: {
    width: '100%',
    marginTop: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    fontSize: '13px',
    fontWeight: 600,
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text-body)',
    cursor: 'pointer',
  },
  focusCount: { color: 'var(--accent)' },
  focusChips: { display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px' },
  chip: {
    fontSize: '12px',
    padding: '3px 8px',
    borderRadius: '999px',
    background: 'var(--accent-chip-bg)',
    color: 'var(--accent-chip-text)',
  },
  focusEditor: {
    marginTop: '10px',
    padding: '12px',
    borderRadius: '10px',
    background: 'var(--surface-3)',
  },
  focusHint: { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.5 },
  abGroup: { marginBottom: '10px' },
  abCategory: { fontSize: '12px', fontWeight: 700, color: 'var(--text)', margin: '6px 0 4px' },
  abRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '5px 0',
  },
  abName: { fontSize: '13px', color: 'var(--text-body)', flex: 1, minWidth: 0 },
  plusBtns: { display: 'flex', gap: '4px', flexShrink: 0 },
  plusBtn: {
    width: '38px',
    padding: '5px 0',
    fontSize: '13px',
    fontWeight: 700,
    borderRadius: '6px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  plusBtnActive: { borderColor: 'var(--accent)', background: 'var(--accent)', color: '#fff' },
  plusBtnDisabled: { opacity: 0.35, cursor: 'not-allowed' },
  abEditToggle: {
    width: '100%',
    marginTop: '16px',
    padding: '11px',
    fontSize: '13px',
    fontWeight: 600,
    borderRadius: '10px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text-body)',
    cursor: 'pointer',
  },
  abEditor: {
    marginTop: '10px',
    padding: '12px',
    borderRadius: '10px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  abAddRow: { display: 'flex', gap: '6px', marginBottom: '10px' },
  abCatInput: {
    width: '72px',
    padding: '8px',
    fontSize: '13px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    boxSizing: 'border-box',
  },
  abNameInput: {
    flex: 1,
    minWidth: 0,
    padding: '8px',
    fontSize: '13px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    boxSizing: 'border-box',
  },
  abAddBtn: {
    padding: '8px 12px',
    fontSize: '13px',
    fontWeight: 700,
    borderRadius: '8px',
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    cursor: 'pointer',
    flexShrink: 0,
  },
  abList: { listStyle: 'none', padding: 0, margin: 0 },
  abListItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '7px 0',
    borderBottom: '1px solid var(--border-subtle)',
    fontSize: '13px',
    color: 'var(--text-body)',
  },
  abListCat: { fontSize: '11px', color: 'var(--text-faint)' },
  abDel: {
    border: 'none',
    background: 'transparent',
    color: 'var(--danger)',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  footNote: { marginTop: '16px', fontSize: '12px', color: 'var(--text-faint)', lineHeight: 1.6 },
};
