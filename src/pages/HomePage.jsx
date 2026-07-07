// 메인 페이지: 로고 헤더 + 설정(⚙️) 진입 + 기능 메뉴 카드 목록.

// 기능별 아이콘 원의 강조색 (반투명이라 라이트/다크 모두 자연스럽게 얹힙니다)
const ACCENTS = {
  todo: '#059669',
  workout: '#7c3aed',
  gtx: '#2563eb',
  work: '#d97706',
  holidays: '#dc2626',
  maplemvp: '#ea580c',
  fcfee: '#0ea5e9',
  datecalc: '#0891b2',
  loan: '#16a34a',
};

export default function HomePage({ menus, onSelect, onOpenSettings }) {
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
        <button style={styles.gearBtn} onClick={onOpenSettings} aria-label="설정">
          ⚙️
        </button>
      </header>

      <p style={styles.greeting}>무엇을 관리할까요?</p>

      <ul style={styles.list}>
        {menus.map((m) => (
          <li key={m.id}>
            <button style={styles.card} onClick={() => onSelect(m.id)}>
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
              <span style={styles.chevron}>›</span>
            </button>
          </li>
        ))}
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
  greeting: { color: 'var(--text-muted)', fontSize: '14px', margin: '0 0 20px' },
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
    cursor: 'pointer',
    textAlign: 'left',
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
};
