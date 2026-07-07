// 상세 페이지 공통 레이아웃: 뒤로가기 버튼 + 제목 + 내용.
// (기존 각 *Page.jsx 에 중복돼 있던 헤더 구조를 한곳으로 모았습니다.)
export default function PageLayout({ title, onBack, children }) {
  return (
    <div>
      <header style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}>
          ← 메뉴
        </button>
        <h1 style={styles.title}>{title}</h1>
      </header>
      {children}
    </div>
  );
}

const styles = {
  header: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' },
  backBtn: {
    padding: '7px 13px',
    fontSize: '14px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-body)',
    cursor: 'pointer',
  },
  title: { fontSize: '18px', margin: 0, color: 'var(--text)' },
};
