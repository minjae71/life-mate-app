// Health Connect(삼성 헬스) 연동 래퍼 — capacitor-health 플러그인.
// 네이티브(안드로이드)에서만 실제 동작하고, 웹에서는 안전하게 미지원 처리합니다.
import { Capacitor } from '@capacitor/core';
import { Health } from 'capacitor-health';

// 걸음 수 + 운동 세션 읽기 권한
const PERMISSIONS = ['READ_STEPS', 'READ_WORKOUTS'];

export function isNativePlatform() {
  return Capacitor.isNativePlatform();
}

// Health Connect 사용 가능 여부(네이티브 + Health Connect 설치)
export async function healthAvailable() {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await Health.isHealthAvailable();
    return !!res?.available;
  } catch {
    return false;
  }
}

// 권한 요청 후, 걸음/운동 권한이 실제로 허용됐는지 반환
export async function requestPermissions() {
  await Health.requestHealthPermissions({ permissions: PERMISSIONS });
  try {
    const res = await Health.checkHealthPermissions({ permissions: PERMISSIONS });
    // 런타임 반환은 { READ_STEPS: true, READ_WORKOUTS: false } 형태의 객체다.
    // (플러그인 타입 정의는 배열이라 어긋남) — 객체·배열 모두 안전하게 처리.
    const p = res?.permissions;
    const granted = Array.isArray(p)
      ? Object.assign({}, ...p)
      : p && typeof p === 'object'
        ? p
        : {};
    return { steps: !!granted.READ_STEPS, workouts: !!granted.READ_WORKOUTS };
  } catch {
    return { steps: true, workouts: true }; // 확인 실패 시 요청은 됐으므로 낙관적으로
  }
}

// 특정 날짜(로컬 'YYYY-MM-DD')의 총 걸음 수
export async function getStepsForDay(iso) {
  const start = new Date(`${iso}T00:00:00`);
  const end = new Date(`${iso}T23:59:59.999`);
  const res = await Health.queryAggregated({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    dataType: 'steps',
    bucket: 'day',
  });
  const data = res?.aggregatedData || [];
  return data.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
}

// 특정 날짜(로컬 'YYYY-MM-DD')의 운동 세션 (시작 시각 최신순)
export async function getWorkoutsForDay(iso) {
  const start = new Date(`${iso}T00:00:00`);
  const end = new Date(`${iso}T23:59:59.999`);
  const res = await Health.queryWorkouts({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    includeHeartRate: false,
    includeRoute: false,
    includeSteps: false, // 플러그인 7.0.0 필수 파라미터
  });
  const workouts = res?.workouts || [];
  return [...workouts].sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
}

// Health Connect 설치 페이지 열기 (미설치 기기용)
export async function openHealthConnectStore() {
  try {
    await Health.showHealthConnectInPlayStore();
  } catch {
    /* 무시 */
  }
}

// Health Connect 앱(권한 관리 화면) 열기 — 운동 권한 재확인/허용용
export async function openHealthConnectSettings() {
  try {
    await Health.openHealthConnectSettings();
  } catch {
    /* 무시 */
  }
}
