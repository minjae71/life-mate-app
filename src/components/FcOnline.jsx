import { useState } from 'react';
import FcTraining from './FcTraining';
import FcFeeCalculator from './FcFeeCalculator';

// FC온라인 기능 묶음: 훈련 관리(훈련코치·집중훈련) + 이적시장 수수료 계산기.
const TABS = [
  { id: 'training', label: '훈련 관리' },
  { id: 'fee', label: '수수료 계산기' },
];

export default function FcOnline() {
  const [tab, setTab] = useState('training');
  return (
    <div>
      <div style={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ ...styles.tab, ...(tab === t.id ? styles.tabActive : {}) }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'training' ? <FcTraining /> : <FcFeeCalculator />}
    </div>
  );
}

const styles = {
  tabs: {
    display: 'flex',
    gap: '6px',
    padding: '4px',
    borderRadius: '10px',
    background: 'var(--surface-3)',
    marginBottom: '18px',
  },
  tab: {
    flex: 1,
    padding: '10px 0',
    fontSize: '14px',
    fontWeight: 600,
    borderRadius: '8px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  tabActive: {
    background: 'var(--surface)',
    color: 'var(--accent)',
    boxShadow: '0 1px 3px var(--shadow)',
  },
};
