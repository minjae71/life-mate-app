import { useEffect, useMemo, useState } from 'react';
import { grandTotal, loadPeople, personTotal, savePeople } from '../utils/loanMemo';
import { newId } from '../utils/id';
import { fmtWon } from '../utils/format';
import { toISO } from '../utils/workHours';

// 정산 관리: 사람 목록(이름+합계) ↔ 상세 내역(날짜·내용·금액) 2단 구조
export default function LoanMemo() {
  const [people, setPeople] = useState(loadPeople);
  const [selectedId, setSelectedId] = useState(null); // null이면 목록 화면
  const [nameInput, setNameInput] = useState('');

  useEffect(() => {
    savePeople(people);
  }, [people]);

  const selected = people.find((p) => p.id === selectedId) || null;

  function addPerson() {
    const name = nameInput.trim();
    if (!name) return;
    setPeople((prev) => [...prev, { id: newId(), name, entries: [] }]);
    setNameInput('');
  }

  function removePerson(id) {
    if (!window.confirm('이 사람과 모든 상세 내역을 삭제할까요?')) return;
    setPeople((prev) => prev.filter((p) => p.id !== id));
  }

  function addEntry(personId, entry) {
    setPeople((prev) =>
      prev.map((p) =>
        p.id === personId ? { ...p, entries: [...p.entries, { id: newId(), ...entry }] } : p
      )
    );
  }
  function removeEntry(personId, entryId) {
    setPeople((prev) =>
      prev.map((p) =>
        p.id === personId ? { ...p, entries: p.entries.filter((e) => e.id !== entryId) } : p
      )
    );
  }

  if (selected) {
    return (
      <PersonDetail
        person={selected}
        onBack={() => setSelectedId(null)}
        onAddEntry={(entry) => addEntry(selected.id, entry)}
        onRemoveEntry={(entryId) => removeEntry(selected.id, entryId)}
      />
    );
  }

  const total = grandTotal(people);

  return (
    <section style={styles.section}>
      <div style={styles.totalCard}>
        <span style={styles.totalLabel}>전체 빌려준 금액</span>
        <span style={styles.totalValue}>{fmtWon(total)}</span>
      </div>

      <div style={styles.addRow}>
        <input
          type="text"
          value={nameInput}
          placeholder="이름 입력"
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addPerson()}
          style={styles.input}
        />
        <button onClick={addPerson} disabled={!nameInput.trim()} style={styles.addBtn}>
          추가
        </button>
      </div>

      {people.length === 0 ? (
        <p style={styles.empty}>빌려준 사람을 추가해 보세요.</p>
      ) : (
        <ul style={styles.list}>
          {people.map((p) => (
            <li key={p.id} style={styles.personItem}>
              <button style={styles.personMain} onClick={() => setSelectedId(p.id)}>
                <span style={styles.personName}>{p.name}</span>
                <span style={styles.personMeta}>
                  <span style={styles.personTotal}>{fmtWon(personTotal(p))}</span>
                  <span style={styles.personCount}>내역 {p.entries.length}건 ›</span>
                </span>
              </button>
              <button style={styles.delBtn} onClick={() => removePerson(p.id)}>
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}

      <p style={styles.footNote}>
        이름을 눌러 상세 내역(날짜·내용·금액)을 입력하면 자동 합산됩니다. 상환받은 금액은
        음수(예: -50000)로 적으면 차감됩니다. 기록은 이 기기에 저장됩니다.
      </p>
    </section>
  );
}

function PersonDetail({ person, onBack, onAddEntry, onRemoveEntry }) {
  const today = useMemo(() => toISO(new Date()), []);
  const [date, setDate] = useState(today);
  const [content, setContent] = useState('');
  const [amount, setAmount] = useState('');

  const total = personTotal(person);
  const sorted = useMemo(
    () => [...person.entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    [person.entries]
  );

  function submit() {
    const amt = Number(amount);
    if (!amt) return;
    onAddEntry({ date: date || today, content: content.trim(), amount: amt });
    setContent('');
    setAmount('');
  }

  return (
    <section style={styles.section}>
      <button style={styles.subBack} onClick={onBack}>
        ‹ 목록
      </button>

      <div style={styles.totalCard}>
        <span style={styles.totalLabel}>{person.name} · 합계</span>
        <span style={styles.totalValue}>{fmtWon(total)}</span>
      </div>

      {/* 내역 추가 */}
      <div style={styles.card}>
        <div style={styles.entryForm}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.formDate} />
          <input
            type="text"
            value={content}
            placeholder="내용 (예: 점심값)"
            onChange={(e) => setContent(e.target.value)}
            style={styles.formContent}
          />
          <div style={styles.formAmountRow}>
            <input
              type="number"
              value={amount}
              placeholder="금액"
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              style={styles.formAmount}
            />
            <button onClick={submit} disabled={!Number(amount)} style={styles.addBtn}>
              추가
            </button>
          </div>
        </div>
      </div>

      {/* 내역 목록 */}
      {sorted.length === 0 ? (
        <p style={styles.empty}>상세 내역을 추가해 보세요.</p>
      ) : (
        <ul style={styles.list}>
          {sorted.map((e) => (
            <li key={e.id} style={styles.entryItem}>
              <div style={styles.entryLeft}>
                <span style={styles.entryDate}>{e.date}</span>
                <span style={styles.entryContent}>{e.content || '내용 없음'}</span>
              </div>
              <span
                style={{
                  ...styles.entryAmount,
                  color: e.amount < 0 ? 'var(--success)' : 'var(--text)',
                }}
              >
                {fmtWon(e.amount)}
              </span>
              <button style={styles.entryDel} onClick={() => onRemoveEntry(e.id)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const styles = {
  section: { marginBottom: '28px', wordBreak: 'keep-all' },
  subBack: {
    padding: '6px 12px',
    fontSize: '14px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-body)',
    cursor: 'pointer',
    marginBottom: '14px',
  },
  totalCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    borderRadius: '14px',
    background: 'var(--accent-weak-bg)',
    border: '1px solid var(--accent-weak-border)',
    marginBottom: '16px',
  },
  totalLabel: { fontSize: '14px', color: 'var(--text-muted)' },
  totalValue: {
    fontSize: '22px',
    fontWeight: 800,
    color: 'var(--accent-strong)',
    fontVariantNumeric: 'tabular-nums',
  },
  addRow: { display: 'flex', gap: '8px', marginBottom: '16px' },
  input: {
    flex: 1,
    padding: '10px 12px',
    fontSize: '15px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
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
  empty: { color: 'var(--text-faint)', fontSize: '14px', textAlign: 'center', padding: '20px 0' },
  list: { listStyle: 'none', padding: 0, margin: 0 },
  personItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 0',
    borderBottom: '1px solid var(--border-subtle)',
  },
  personMain: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '12px 6px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  },
  personName: { fontSize: '16px', fontWeight: 600, color: 'var(--text)' },
  personMeta: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' },
  personTotal: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--accent-strong)',
    fontVariantNumeric: 'tabular-nums',
  },
  personCount: { fontSize: '12px', color: 'var(--text-faint)' },
  delBtn: {
    padding: '4px 10px',
    fontSize: '12px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-faint)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  card: {
    padding: '14px',
    borderRadius: '14px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    marginBottom: '16px',
  },
  entryForm: { display: 'flex', flexDirection: 'column', gap: '8px' },
  formDate: {
    padding: '9px 10px',
    fontSize: '14px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface-2)',
  },
  formContent: {
    padding: '9px 10px',
    fontSize: '14px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface-2)',
  },
  formAmountRow: { display: 'flex', gap: '8px' },
  formAmount: {
    flex: 1,
    padding: '9px 10px',
    fontSize: '15px',
    fontWeight: 600,
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface-2)',
    textAlign: 'right',
  },
  entryItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '11px 4px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  entryLeft: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
  entryDate: { fontSize: '12px', color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' },
  entryContent: { fontSize: '14px', color: 'var(--text-body)' },
  entryAmount: { fontSize: '15px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  entryDel: {
    width: '28px',
    height: '28px',
    fontSize: '13px',
    borderRadius: '6px',
    border: 'none',
    background: 'var(--surface-3)',
    color: 'var(--text-faint)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  footNote: { marginTop: '14px', fontSize: '12px', color: 'var(--text-faint)', lineHeight: 1.6 },
};
