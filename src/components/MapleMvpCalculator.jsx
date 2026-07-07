import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_GRADES,
  computeMvp,
  fmtWonShort,
  loadGrades,
  loadState,
  netCash,
  saveGrades,
  saveState,
} from '../utils/mapleMvp';
import { fmtWon } from '../utils/format';

// 메이플 MVP 등급 트래커 + 실비용 계산기
export default function MapleMvpCalculator() {
  const saved = useMemo(loadState, []);
  const [grades, setGrades] = useState(loadGrades);
  const [spent, setSpent] = useState(saved.spent ?? 0);
  const [recovery, setRecovery] = useState(saved.recovery ?? 90);
  const [targetId, setTargetId] = useState(saved.targetId ?? '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(loadGrades().map((g) => [g.id, g.threshold]))
  );

  const { current, next, remainingToNext, progress, sorted } = useMemo(
    () => computeMvp(spent, grades),
    [spent, grades]
  );

  // 목표 등급: 저장값이 유효하면 사용, 없으면 다음 등급(없으면 최고 등급)
  const target = useMemo(() => {
    const byId = sorted.find((g) => g.id === targetId);
    if (byId) return byId;
    return next || sorted[sorted.length - 1];
  }, [sorted, targetId, next]);

  const remainingToTarget = target ? Math.max(0, target.threshold - spent) : 0;
  const targetNet = netCash(remainingToTarget, recovery);

  useEffect(() => {
    saveState({ spent, recovery, targetId });
  }, [spent, recovery, targetId]);

  function saveThresholds() {
    const nextGrades = grades.map((g) => ({
      ...g,
      threshold: Math.max(0, Number(draft[g.id]) || 0),
    }));
    setGrades(nextGrades);
    saveGrades(nextGrades);
    setEditing(false);
  }

  function resetThresholds() {
    setGrades(DEFAULT_GRADES);
    saveGrades(DEFAULT_GRADES);
    setDraft(Object.fromEntries(DEFAULT_GRADES.map((g) => [g.id, g.threshold])));
  }

  return (
    <section style={styles.section}>
      {/* 입력 */}
      <div style={styles.card}>
        <label style={styles.fieldLabel}>최근 13주 누적 결제 금액 (원)</label>
        <input
          type="number"
          min="0"
          inputMode="numeric"
          value={spent}
          onChange={(e) => setSpent(Math.max(0, Number(e.target.value)))}
          style={styles.bigInput}
        />
        <p style={styles.hint}>
          게임 내 MVP UI의 “최근 13주 누적 결제금액”을 입력하세요. (넥슨캐시 1원 = 1캐시)
        </p>
      </div>

      {/* 현재 등급 + 진행도 */}
      <div style={styles.card}>
        <div style={styles.gradeRow}>
          <span style={styles.gradeCaption}>현재 등급</span>
          {current ? (
            <GradeBadge grade={current} big />
          ) : (
            <span style={styles.noGrade}>무등급 (15만원 미만)</span>
          )}
        </div>

        {next ? (
          <>
            <div style={styles.barTrack}>
              <div
                style={{
                  ...styles.barFill,
                  width: `${Math.round(progress * 100)}%`,
                  background: next.color,
                }}
              />
            </div>
            <div style={styles.nextRow}>
              <span style={styles.nextText}>
                다음 <strong style={{ color: next.color }}>{next.name}</strong>까지
              </span>
              <span style={styles.nextAmount}>{fmtWon(remainingToNext)}</span>
            </div>
          </>
        ) : (
          <p style={styles.maxText}>최고 등급을 달성했습니다! 🎉</p>
        )}
      </div>

      {/* 목표까지 실비용 */}
      <div style={styles.card}>
        <div style={styles.targetHead}>
          <label style={styles.fieldLabel}>목표 등급</label>
          <select
            value={target?.id || ''}
            onChange={(e) => setTargetId(e.target.value)}
            style={styles.select}
          >
            {sorted.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({fmtWonShort(g.threshold)})
              </option>
            ))}
          </select>
        </div>

        <div style={styles.recoveryRow}>
          <label style={styles.fieldLabel}>회수율</label>
          <div style={styles.recoveryInputWrap}>
            <input
              type="number"
              min="0"
              max="100"
              value={recovery}
              onChange={(e) => setRecovery(Math.min(100, Math.max(0, Number(e.target.value))))}
              style={styles.smallInput}
            />
            <span style={styles.pct}>%</span>
          </div>
        </div>
        <p style={styles.hint}>
          캐시템을 되팔아 돌려받는 비율입니다. MVP작 없이 순수 결제만 하면 0%.
        </p>

        <div style={styles.resultGrid}>
          <div style={styles.resultItem}>
            <div style={styles.resultLabel}>목표까지 남은 실적</div>
            <div style={styles.resultValue}>{fmtWon(remainingToTarget)}</div>
          </div>
          <div style={styles.resultItem}>
            <div style={styles.resultLabel}>예상 실제 현금</div>
            <div style={{ ...styles.resultValue, color: 'var(--accent-strong)' }}>
              {fmtWon(targetNet)}
            </div>
          </div>
        </div>
        {remainingToTarget === 0 && (
          <p style={styles.doneText}>이미 목표 등급 이상입니다. ✅</p>
        )}
      </div>

      {/* 등급표 */}
      <div style={styles.card}>
        <div style={styles.tableHead}>
          <span style={styles.tableTitle}>등급 기준 (13주 누적)</span>
          <button
            style={styles.editBtn}
            onClick={() => {
              setDraft(Object.fromEntries(grades.map((g) => [g.id, g.threshold])));
              setEditing((v) => !v);
            }}
          >
            {editing ? '취소' : '기준 편집'}
          </button>
        </div>

        <ul style={styles.gradeList}>
          {sorted.map((g) => {
            const achieved = spent >= g.threshold;
            const isCurrent = current?.id === g.id;
            return (
              <li
                key={g.id}
                style={{ ...styles.gradeItem, ...(isCurrent ? styles.gradeItemCurrent : {}) }}
              >
                <GradeBadge grade={g} />
                {editing ? (
                  <input
                    type="number"
                    min="0"
                    value={draft[g.id]}
                    onChange={(e) => setDraft({ ...draft, [g.id]: e.target.value })}
                    style={styles.editInput}
                  />
                ) : (
                  <span style={styles.gradeAmount}>{fmtWon(g.threshold)}</span>
                )}
                <span style={styles.gradeMark}>
                  {achieved ? '✓' : ''}
                </span>
              </li>
            );
          })}
        </ul>

        {editing && (
          <div style={styles.editActions}>
            <button style={styles.resetBtn} onClick={resetThresholds}>
              기본값 복원
            </button>
            <button style={styles.saveBtn} onClick={saveThresholds}>
              저장
            </button>
          </div>
        )}
      </div>

      <p style={styles.footNote}>
        MVP 등급은 넥슨캐시 충전이 아니라 <b>캐시아이템 구매 등 실제 사용 금액</b> 기준으로
        산정됩니다. 기준 금액은 공식 공개 수치가 아니므로 게임 내 MVP UI 값에 맞춰 편집해
        쓰세요. 계산값은 이 기기에 저장됩니다.
      </p>
    </section>
  );
}

function GradeBadge({ grade, big }) {
  return (
    <span
      style={{
        ...styles.badge,
        ...(big ? styles.badgeBig : {}),
        background: grade.color,
      }}
    >
      {grade.name}
    </span>
  );
}

const styles = {
  section: { marginBottom: '28px', wordBreak: 'keep-all' },
  card: {
    padding: '16px',
    borderRadius: '14px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    marginBottom: '14px',
  },
  fieldLabel: { fontSize: '13px', fontWeight: 600, color: 'var(--text-body)' },
  bigInput: {
    width: '100%',
    marginTop: '8px',
    padding: '12px',
    fontSize: '20px',
    fontWeight: 700,
    borderRadius: '10px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface-2)',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  hint: { fontSize: '12px', color: 'var(--text-faint)', margin: '8px 0 0', lineHeight: 1.5 },
  gradeRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '14px',
  },
  gradeCaption: { fontSize: '14px', color: 'var(--text-muted)' },
  noGrade: { fontSize: '15px', fontWeight: 700, color: 'var(--text-faint)' },
  barTrack: {
    height: '10px',
    borderRadius: '999px',
    background: 'var(--surface-3)',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: '999px', transition: 'width 0.3s ease' },
  nextRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: '10px',
  },
  nextText: { fontSize: '13px', color: 'var(--text-muted)' },
  nextAmount: {
    fontSize: '16px',
    fontWeight: 700,
    color: 'var(--text)',
    fontVariantNumeric: 'tabular-nums',
  },
  maxText: { fontSize: '15px', fontWeight: 600, color: 'var(--success)', margin: '4px 0 0' },
  targetHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
  },
  select: {
    flex: 1,
    maxWidth: '60%',
    padding: '8px 10px',
    fontSize: '14px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
  },
  recoveryRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '14px',
  },
  recoveryInputWrap: { display: 'flex', alignItems: 'center', gap: '6px' },
  smallInput: {
    width: '80px',
    padding: '8px 10px',
    fontSize: '15px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    textAlign: 'right',
  },
  pct: { fontSize: '14px', color: 'var(--text-muted)' },
  resultGrid: { display: 'flex', gap: '10px', marginTop: '14px' },
  resultItem: {
    flex: 1,
    padding: '12px',
    borderRadius: '10px',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    textAlign: 'center',
  },
  resultLabel: { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' },
  resultValue: {
    fontSize: 'clamp(15px, 4.4vw, 19px)',
    fontWeight: 700,
    color: 'var(--text)',
    fontVariantNumeric: 'tabular-nums',
  },
  doneText: { fontSize: '13px', fontWeight: 600, color: 'var(--success)', margin: '12px 0 0' },
  tableHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
  },
  tableTitle: { fontSize: '14px', fontWeight: 700, color: 'var(--text)' },
  editBtn: {
    padding: '5px 12px',
    fontSize: '13px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text-body)',
    cursor: 'pointer',
  },
  gradeList: { listStyle: 'none', padding: 0, margin: 0 },
  gradeItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 6px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  gradeItemCurrent: { background: 'var(--accent-weak-bg)', borderRadius: '8px' },
  gradeAmount: {
    flex: 1,
    fontSize: '14px',
    color: 'var(--text-body)',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  editInput: {
    flex: 1,
    padding: '6px 8px',
    fontSize: '14px',
    borderRadius: '6px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface-2)',
    textAlign: 'right',
  },
  gradeMark: { width: '18px', textAlign: 'center', color: 'var(--success)', fontWeight: 700 },
  editActions: { display: 'flex', gap: '8px', marginTop: '12px' },
  resetBtn: {
    flex: 1,
    padding: '10px',
    fontSize: '14px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text-body)',
    cursor: 'pointer',
  },
  saveBtn: {
    flex: 1,
    padding: '10px',
    fontSize: '14px',
    fontWeight: 700,
    borderRadius: '8px',
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    cursor: 'pointer',
  },
  badge: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#fff',
    borderRadius: '8px',
    padding: '4px 12px',
    whiteSpace: 'nowrap',
  },
  badgeBig: { fontSize: '16px', padding: '6px 16px' },
  footNote: { marginTop: '4px', fontSize: '12px', color: 'var(--text-faint)', lineHeight: 1.6 },
};
