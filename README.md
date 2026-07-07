# LifeMate

일상에 필요한 여러 도구를 한 앱에 모은 개인용 멀티툴입니다. React + Vite 로 만들고,
Capacitor 로 안드로이드 앱(APK)으로 빌드합니다. 모든 데이터는 기기의 `localStorage` 에만
저장되며 외부로 전송되지 않습니다.

## 기능

홈 화면에서 메뉴를 선택해 진입합니다. (우상단 ⚙️ 에서 테마·데이터 관리)

- **오늘의 할일** — 매일 반복 체크리스트. 자정이 지나면 체크만 자동 초기화(목록은 유지).
- **운동 기록** — 달력에 상체/하체를 번갈아 기록. 하나는 쉬어도 완료 인정.
- **GTX-A 연계 출발 안내** — 강남구청·선릉 → 수서 환승 → 동탄. 수인분당선 시간표 연계 +
  (API 키가 있으면) 실시간 도착 정보.
- **근무시간 계산기** — 유연근무 월 단위 정산. 남은 근무·하루 평균 필요 시간(초 단위).
- **공휴일 관리** — 공휴일 직접 등록/제외 (근무일 계산에 반영).
- **메이플 MVP 계산기** — 13주 누적 결제로 등급·목표까지 실비용 계산 (기준 금액 편집 가능).
- **FC온라인 수수료 계산기** — 이적시장 다중 입력창, 판매 실수령 계산 (PC방·TOP CLASS·쿠폰 할인).
- **날짜 계산기** — 두 날짜 사이 일수 / 기준일 ± 기간 계산.
- **정산 관리** — 사람별 상세 내역(날짜·내용·금액) 입력 후 자동 합산.

설정(홈 ⚙️): 테마 라이트/다크/시스템, 데이터 기능별·전체 삭제.

## 기술 스택

- **React 18** + **Vite 5** (JSX, 인라인 스타일 + `src/theme.css` 의 CSS 변수 토큰으로 다크모드)
- **Capacitor 7** (`@capacitor/app`, `@capacitor/splash-screen`) — 안드로이드 네이티브 래핑

## 개발

```bash
npm install
npm run dev     # http://localhost:5173
```

### 환경변수 (선택)

GTX **실시간 도착** 기능만 서울 열린데이터광장 API 키가 필요합니다. 없어도 시간표 계산은 동작합니다.

1. `.env.example` 를 `.env` 로 복사
2. https://data.seoul.go.kr 에서 "지하철 실시간 도착정보" 인증키 발급 후 값 입력

```
VITE_SEOUL_SUBWAY_API_KEY=발급받은키
```

> 개발 서버에서는 `vite.config.js` 의 proxy(`/api/subway`)가 CORS 를 우회합니다.
> 네이티브 앱에서는 `CapacitorHttp` 로 직접 호출합니다.

## 안드로이드 빌드 (APK)

먼저 웹을 빌드해 안드로이드로 동기화합니다.

```bash
npm run sync:android      # vite build + cap sync android
```

이후 APK 빌드는 **Windows 쪽 JDK/SDK**(Android Studio JBR)로 이뤄집니다. WSL 에서 리눅스
Gradle 로는 동작하지 않으므로, Windows 네이티브 `gradlew.bat` 를 사용합니다.

```bat
:: android\ 폴더에서 (JAVA_HOME 은 Android Studio JBR 경로)
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
gradlew.bat assembleDebug
```

산출물: `android/app/build/outputs/apk/debug/app-debug.apk`
(설치: `adb install -r <위 경로>`)

Android Studio 로 열려면: `npm run open:android`

## 프로젝트 구조

```
src/
  App.jsx              메뉴 목록(MENUS) + 화면 라우팅 + 안드로이드 뒤로가기 처리
  main.jsx             엔트리. 테마 초기화 + 스플래시 제어
  theme.css            라이트/다크 디자인 토큰 + 기본 스타일
  pages/HomePage.jsx   홈 (로고 헤더 + 기능 카드)
  components/          각 기능 UI + PageLayout, Settings
  utils/               기능별 로직 (workHours, workout, holidays, gtxPlanner,
                       mapleMvp, fcFee, dateCalc, loanMemo, theme, storage,
                       공용: id, format)
  data/                시간표·공휴일 등 정적 데이터
  api/seoulSubway.js   지하철 실시간 도착 API 호출
```
