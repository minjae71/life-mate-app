import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './theme.css';
import { initTheme } from './utils/theme';
import { SplashScreen } from '@capacitor/splash-screen';

initTheme();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 앱이 마운트되면 스플래시를 감춥니다.
// 1) 네이티브 스플래시(플러그인)를 먼저 숨겨 웹뷰를 드러내고
// 2) 동일한 디자인의 HTML 스플래시를 부드럽게 페이드아웃 → 이음매 없는 전환.
window.addEventListener('load', () => {
  // 네이티브(APK)에서만 실제 동작, 웹에서는 무해한 no-op.
  SplashScreen.hide().catch(() => {});

  const splash = document.getElementById('splash');
  if (!splash) return;
  setTimeout(() => {
    splash.classList.add('hide');
    setTimeout(() => splash.remove(), 500);
  }, 600);
});
