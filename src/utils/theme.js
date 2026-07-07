// 테마(라이트/다크/시스템) 관리. 선택값은 localStorage에 저장되고,
// 실제 적용은 <html data-theme="light|dark"> 로 이루어집니다. (색상은 theme.css의 토큰)
export const THEME_KEY = 'app:theme'; // 'system' | 'light' | 'dark'

export function getStoredTheme() {
  return localStorage.getItem(THEME_KEY) || 'system';
}

// 선택값('system' 포함)을 실제 'light' | 'dark' 로 해석
export function resolveTheme(pref) {
  if (pref === 'dark' || pref === 'light') return pref;
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function applyTheme(pref) {
  document.documentElement.dataset.theme = resolveTheme(pref);
}

export function setTheme(pref) {
  localStorage.setItem(THEME_KEY, pref);
  applyTheme(pref);
}

// 앱 시작 시 1회 호출: 저장된 테마 적용 + 시스템 테마 변경 실시간 반영
export function initTheme() {
  applyTheme(getStoredTheme());
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', () => {
    if (getStoredTheme() === 'system') applyTheme('system');
  });
}
