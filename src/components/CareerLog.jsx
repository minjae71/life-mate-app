import { useEffect, useMemo, useState } from 'react';
import { newId } from '../utils/id';
import {
  CAREER_KEY,
  MONTHS,
  SORT_OPTIONS,
  emptyCareer,
  formatDuration,
  formatPeriod,
  isValidCareer,
  loadCareers,
  sortCareers,
  yearOptions,
} from '../utils/career';

// 경력 관리: 수행처·프로젝트·기간·직무·관련 기술을 이 기기에 저장합니다.
export default function CareerLog() {
  const [list, setList] = useState(loadCareers);
  const [editingId, setEditingId] = useState(null); // null=닫힘, 'new'=신규, id=수정
  const [form, setForm] = useState(emptyCareer);
  const [techText, setTechText] = useState('');
  const [sort, setSort] = useState('recent');

  const years = useMemo(yearOptions, []);

  useEffect(() => {
    localStorage.setItem(CAREER_KEY, JSON.stringify(list));
  }, [list]);

  const sorted = useMemo(() => sortCareers(list, sort), [list, sort]);
  const isOpen = editingId !== null;

  function openNew() {
    setForm(emptyCareer());
    setTechText('');
    setEditingId('new');
  }
  function openEdit(c) {
    setForm({ ...emptyCareer(), ...c });
    setTechText('');
    setEditingId(c.id);
  }
  function closeForm() {
    setEditingId(null);
    setTechText('');
  }

  function setField(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
  }

  function toggleOngoing() {
    setForm((f) =>
      f.ongoing
        ? { ...f, ongoing: false }
        : { ...f, ongoing: true, endYear: '', endMonth: '' }
    );
  }

  function addTech() {
    const t = techText.trim();
    if (!t) return;
    setForm((f) =>
      f.technologies.includes(t) ? f : { ...f, technologies: [...f.technologies, t] }
    );
    setTechText('');
  }
  function removeTech(t) {
    setForm((f) => ({ ...f, technologies: f.technologies.filter((x) => x !== t) }));
  }

  function save() {
    if (!isValidCareer(form)) return;
    const clean = {
      ...form,
      workplace: form.workplace.trim(),
      projectName: form.projectName.trim(),
      role: form.role.trim(),
      startYear: Number(form.startYear),
      startMonth: Number(form.startMonth),
      endYear: form.ongoing || !form.endYear ? '' : Number(form.endYear),
      endMonth: form.ongoing || !form.endMonth ? '' : Number(form.endMonth),
    };
    if (editingId === 'new') {
      setList((prev) => [...prev, { ...clean, id: newId() }]);
    } else {
      setList((prev) => prev.map((c) => (c.id === editingId ? { ...clean, id: editingId } : c)));
    }
    closeForm();
  }

  function remove(id) {
    if (!window.confirm('이 경력을 삭제할까요?')) return;
    setList((prev) => prev.filter((c) => c.id !== id));
    if (editingId === id) closeForm();
  }

  const canSave = isValidCareer(form);

  return (
    <section style={styles.section}>
      {!isOpen && (
        <button onClick={openNew} style={styles.addTopBtn}>
          + 경력 등록
        </button>
      )}

      {/* 입력 폼 */}
      {isOpen && (
        <div style={styles.form}>
          <div style={styles.formTitle}>{editingId === 'new' ? '경력 등록' : '경력 수정'}</div>

          <label style={styles.label}>수행처</label>
          <input
            type="text"
            value={form.workplace}
            placeholder="예: BGF리테일, 프리랜서"
            onChange={(e) => setField('workplace', e.target.value)}
            style={styles.input}
          />

          <label style={styles.label}>프로젝트명</label>
          <input
            type="text"
            value={form.projectName}
            placeholder="예: 통합 업무 시스템 구축"
            onChange={(e) => setField('projectName', e.target.value)}
            style={styles.input}
          />

          <label style={styles.label}>시작기간</label>
          <div style={styles.periodRow}>
            <select
              value={form.startYear}
              onChange={(e) => setField('startYear', e.target.value)}
              style={styles.select}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
            <select
              value={form.startMonth}
              onChange={(e) => setField('startMonth', e.target.value)}
              style={styles.select}
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>
          </div>

          <label style={styles.checkLabel}>
            <input type="checkbox" checked={form.ongoing} onChange={toggleOngoing} />
            진행 중 (재직/수행 중)
          </label>

          {!form.ongoing && (
            <>
              <label style={styles.label}>종료기간</label>
              <div style={styles.periodRow}>
                <select
                  value={form.endYear}
                  onChange={(e) => setField('endYear', e.target.value)}
                  style={styles.select}
                >
                  <option value="">연도</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}년
                    </option>
                  ))}
                </select>
                <select
                  value={form.endMonth}
                  onChange={(e) => setField('endMonth', e.target.value)}
                  style={styles.select}
                >
                  <option value="">월</option>
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}월
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <label style={styles.label}>직무</label>
          <input
            type="text"
            value={form.role}
            placeholder="예: 백엔드 개발"
            onChange={(e) => setField('role', e.target.value)}
            style={styles.input}
          />

          <label style={styles.label}>관련 기술</label>
          <div style={styles.techInputRow}>
            <input
              type="text"
              value={techText}
              placeholder="입력 후 Enter (예: JAVA)"
              onChange={(e) => setTechText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTech();
                }
              }}
              style={{ ...styles.input, marginBottom: 0, flex: 1 }}
            />
            <button onClick={addTech} disabled={!techText.trim()} style={styles.techAddBtn}>
              추가
            </button>
          </div>
          {form.technologies.length > 0 && (
            <div style={styles.chipWrap}>
              {form.technologies.map((t) => (
                <button key={t} onClick={() => removeTech(t)} style={styles.chipEditable}>
                  {t} <span style={styles.chipX}>×</span>
                </button>
              ))}
            </div>
          )}

          <div style={styles.formBtns}>
            <button onClick={closeForm} style={styles.cancelBtn}>
              취소
            </button>
            <button onClick={save} disabled={!canSave} style={styles.saveBtn}>
              {editingId === 'new' ? '등록' : '수정'}
            </button>
          </div>
          {!canSave && (
            <p style={styles.warn}>수행처·프로젝트명·시작기간은 필수입니다.</p>
          )}
        </div>
      )}

      {/* 정렬 도구 */}
      {sorted.length > 0 && (
        <div style={styles.toolbar}>
          <span style={styles.count}>총 {sorted.length}건</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={styles.sortSelect}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 경력 목록 */}
      {sorted.length === 0 && !isOpen ? (
        <div style={styles.empty}>등록된 경력이 없습니다. 위 버튼으로 추가하세요.</div>
      ) : (
        <ul style={styles.list}>
          {sorted.map((c) => {
            const duration = formatDuration(c);
            return (
              <li key={c.id} style={styles.card}>
                <div style={styles.cardHead}>
                  <span style={styles.period}>{formatPeriod(c)}</span>
                  {c.ongoing && <span style={styles.ongoingTag}>진행 중</span>}
                  {duration && <span style={styles.duration}>{duration}</span>}
                </div>
                <div style={styles.project}>{c.projectName}</div>
                <div style={styles.meta}>
                  <span style={styles.workplace}>{c.workplace}</span>
                  {c.role && <span style={styles.role}>· {c.role}</span>}
                </div>
                {c.technologies?.length > 0 && (
                  <div style={styles.chipWrap}>
                    {c.technologies.map((t) => (
                      <span key={t} style={styles.chip}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div style={styles.cardBtns}>
                  <button onClick={() => openEdit(c)} style={styles.editBtn}>
                    수정
                  </button>
                  <button onClick={() => remove(c.id)} style={styles.delBtn}>
                    삭제
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p style={styles.footNote}>
        수행처·프로젝트·기간·직무·관련 기술을 기록합니다. 진행 중이면 종료기간을 비워두세요.
        최신 경력이 위에 오도록 정렬되며, 기록은 이 기기에 저장됩니다.
      </p>
    </section>
  );
}

const styles = {
  section: { marginBottom: '28px', wordBreak: 'keep-all' },
  addTopBtn: {
    width: '100%',
    padding: '12px 0',
    fontSize: '15px',
    fontWeight: 700,
    borderRadius: '10px',
    border: 'none',
    background: 'var(--purple)',
    color: '#fff',
    cursor: 'pointer',
    marginBottom: '16px',
  },
  form: {
    padding: '16px',
    borderRadius: '12px',
    background: 'var(--purple-weak-bg)',
    border: '1px solid var(--purple-border)',
    marginBottom: '18px',
  },
  formTitle: { fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: 'var(--text)' },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-body)',
    marginBottom: '5px',
  },
  input: {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    padding: '9px 12px',
    fontSize: '14px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    marginBottom: '12px',
  },
  periodRow: { display: 'flex', gap: '8px', marginBottom: '12px' },
  select: {
    flex: 1,
    padding: '9px 10px',
    fontSize: '14px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
  },
  checkLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: 'var(--text-body)',
    marginBottom: '12px',
    cursor: 'pointer',
  },
  techInputRow: { display: 'flex', gap: '8px', marginBottom: '10px' },
  techAddBtn: {
    padding: '9px 14px',
    fontSize: '14px',
    fontWeight: 600,
    borderRadius: '8px',
    border: '1px solid var(--purple-border-strong)',
    background: 'var(--surface)',
    color: 'var(--purple)',
    cursor: 'pointer',
  },
  chipWrap: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px', marginBottom: '4px' },
  chip: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--purple)',
    background: 'var(--purple-chip-bg)',
    borderRadius: '999px',
    padding: '3px 10px',
  },
  chipEditable: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--purple)',
    background: 'var(--purple-chip-bg)',
    border: '1px solid var(--purple-border)',
    borderRadius: '999px',
    padding: '3px 10px',
    cursor: 'pointer',
  },
  chipX: { fontWeight: 700, marginLeft: '2px' },
  formBtns: { display: 'flex', gap: '8px', marginTop: '14px' },
  cancelBtn: {
    flex: 1,
    padding: '10px 0',
    fontSize: '14px',
    fontWeight: 600,
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text-body)',
    cursor: 'pointer',
  },
  saveBtn: {
    flex: 1,
    padding: '10px 0',
    fontSize: '14px',
    fontWeight: 700,
    borderRadius: '8px',
    border: 'none',
    background: 'var(--purple)',
    color: '#fff',
    cursor: 'pointer',
  },
  warn: { fontSize: '12px', color: 'var(--danger)', marginTop: '8px', marginBottom: 0 },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
  },
  count: { fontSize: '13px', color: 'var(--text-muted)' },
  sortSelect: {
    padding: '6px 10px',
    fontSize: '13px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text-body)',
    cursor: 'pointer',
  },
  empty: {
    padding: '28px 16px',
    textAlign: 'center',
    fontSize: '14px',
    color: 'var(--text-muted)',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
  },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' },
  card: {
    padding: '14px',
    borderRadius: '12px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  cardHead: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' },
  period: { fontSize: '13px', fontWeight: 700, color: 'var(--purple)' },
  ongoingTag: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#fff',
    background: 'var(--success)',
    borderRadius: '999px',
    padding: '2px 8px',
  },
  duration: { fontSize: '12px', color: 'var(--text-muted)' },
  project: { fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' },
  meta: { fontSize: '14px', color: 'var(--text-body)', marginBottom: '6px' },
  workplace: { fontWeight: 600 },
  role: { color: 'var(--text-muted)', marginLeft: '4px' },
  cardBtns: { display: 'flex', gap: '8px', marginTop: '10px' },
  editBtn: {
    padding: '5px 14px',
    fontSize: '13px',
    borderRadius: '6px',
    border: '1px solid var(--purple-border-strong)',
    background: 'var(--surface)',
    color: 'var(--purple)',
    cursor: 'pointer',
  },
  delBtn: {
    padding: '5px 14px',
    fontSize: '13px',
    borderRadius: '6px',
    border: '1px solid var(--danger-border)',
    background: 'var(--surface)',
    color: 'var(--danger)',
    cursor: 'pointer',
  },
  footNote: { marginTop: '16px', fontSize: '12px', color: 'var(--text-faint)', lineHeight: 1.5 },
};
