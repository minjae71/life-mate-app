import { useState } from 'react';
import { getStoredTheme, setTheme } from '../utils/theme';
import { DATA_GROUPS, clearGroup, clearAllData } from '../utils/storage';

const THEME_OPTIONS = [
  { id: 'system', label: '시스템', icon: '🖥️' },
  { id: 'light', label: '라이트', icon: '☀️' },
  { id: 'dark', label: '다크', icon: '🌙' },
];

const APP_VERSION = '0.1.0';

// 설정: 테마(라이트/다크/시스템) 전환 + 데이터 삭제(기능별/전체)
export default function Settings() {
  const [theme, setThemeState] = useState(getStoredTheme);

  function chooseTheme(id) {
    setTheme(id);
    setThemeState(id);
  }

  function clearOne(group) {
    if (!window.confirm(`'${group.label}' 데이터를 삭제할까요? 되돌릴 수 없습니다.`)) {
      return;
    }
    clearGroup(group.id);
    // 각 화면은 진입 시 localStorage를 읽으므로, 반영을 위해 새로고침합니다.
    window.location.reload();
  }

  function clearEverything() {
    if (
      !window.confirm(
        '모든 데이터(할일·운동기록·근무시간·공휴일)를 삭제하고 앱을 초기화할까요?\n되돌릴 수 없습니다.'
      )
    ) {
      return;
    }
    clearAllData();
    window.location.reload();
  }

  return (
    <section style={styles.section}>
      {/* 화면 */}
      <h2 style={styles.groupTitle}>화면</h2>
      <div style={styles.card}>
        <div style={styles.rowLabel}>테마</div>
        <div style={styles.segmented}>
          {THEME_OPTIONS.map((opt) => {
            const active = theme === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => chooseTheme(opt.id)}
                style={{ ...styles.segBtn, ...(active ? styles.segBtnActive : {}) }}
              >
                <span style={styles.segIcon}>{opt.icon}</span>
                {opt.label}
              </button>
            );
          })}
        </div>
        <p style={styles.hint}>
          '시스템'은 기기의 다크모드 설정을 자동으로 따라갑니다.
        </p>
      </div>

      {/* 데이터 관리 */}
      <h2 style={styles.groupTitle}>데이터 관리</h2>
      <div style={styles.card}>
        <p style={styles.hint}>기능별로 저장된 데이터를 삭제할 수 있습니다.</p>
        <ul style={styles.list}>
          {DATA_GROUPS.map((g) => (
            <li key={g.id} style={styles.dataRow}>
              <span style={styles.dataLabel}>{g.label}</span>
              <button onClick={() => clearOne(g)} style={styles.clearBtn}>
                삭제
              </button>
            </li>
          ))}
        </ul>
        <button onClick={clearEverything} style={styles.dangerBtn}>
          모든 데이터 삭제 (앱 초기화)
        </button>
      </div>

      {/* 정보 */}
      <h2 style={styles.groupTitle}>정보</h2>
      <div style={styles.card}>
        <div style={styles.infoRow}>
          <span style={styles.dataLabel}>앱 버전</span>
          <span style={styles.infoValue}>LifeMate v{APP_VERSION}</span>
        </div>
        <p style={styles.hint}>
          모든 데이터는 이 기기에만 저장되며 외부로 전송되지 않습니다.
        </p>
      </div>
    </section>
  );
}

const styles = {
  section: { marginBottom: '28px' },
  groupTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    margin: '20px 0 8px',
  },
  card: {
    padding: '16px',
    borderRadius: '14px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  rowLabel: { fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '10px' },
  segmented: {
    display: 'flex',
    gap: '6px',
    padding: '4px',
    borderRadius: '10px',
    background: 'var(--surface-3)',
  },
  segBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '9px 0',
    fontSize: '14px',
    fontWeight: 600,
    borderRadius: '8px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease, color 0.15s ease',
  },
  segBtnActive: {
    background: 'var(--surface)',
    color: 'var(--accent)',
    boxShadow: '0 1px 3px var(--shadow)',
  },
  segIcon: { fontSize: '15px' },
  hint: { fontSize: '12px', color: 'var(--text-faint)', margin: '10px 0 0', lineHeight: 1.5 },
  list: { listStyle: 'none', padding: 0, margin: '4px 0 0' },
  dataRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '11px 0',
    borderBottom: '1px solid var(--border-subtle)',
  },
  dataLabel: { fontSize: '14px', color: 'var(--text-body)' },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoValue: { fontSize: '14px', fontWeight: 600, color: 'var(--text)' },
  clearBtn: {
    padding: '5px 12px',
    fontSize: '13px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  dangerBtn: {
    width: '100%',
    marginTop: '14px',
    padding: '12px',
    fontSize: '14px',
    fontWeight: 700,
    borderRadius: '10px',
    border: '1px solid var(--danger-border)',
    background: 'transparent',
    color: 'var(--danger)',
    cursor: 'pointer',
  },
};
