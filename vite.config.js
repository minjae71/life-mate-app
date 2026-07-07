import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 서울 열린데이터광장 실시간 도착정보 API는 브라우저에서 직접 호출 시 CORS 문제가 생길 수 있어,
// 개발 중에는 /api/subway 로 시작하는 요청을 실제 API 서버로 프록시합니다.
// (APK 빌드 시에는 CapacitorHttp 등 네이티브 방식으로 전환 필요 - README 참고)
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/subway': {
        target: 'http://swopenapi.seoul.go.kr',
        changeOrigin: true,
      },
    },
  },
});
