import { useCallback, useEffect, useState } from 'react';
import {
  getStepsForDay,
  getWorkoutsForDay,
  healthAvailable,
  isNativePlatform,
  openHealthConnectSettings,
  openHealthConnectStore,
  requestPermissions,
} from '../utils/health';

// 운동 세션 종류 코드 → 한글 라벨(대표적인 것만). 나머지는 원문 표시.
const WORKOUT_LABELS = {
  RUNNING: '러닝',
  WALKING: '걷기',
  BIKING: '자전거',
  STRENGTH_TRAINING: '근력 운동',
  WEIGHTLIFTING: '웨이트',
  HIKING: '등산',
  SWIMMING: '수영',
  YOGA: '요가',
  ELLIPTICAL: '일립티컬',
  OTHER: '기타',
};

function workoutLabel(type) {
  if (type == null) return '운동';
  const key = String(type).toUpperCase();
  return WORKOUT_LABELS[key] || String(type);
}

function minutesBetween(a, b) {
  const ms = new Date(b) - new Date(a);
  return ms > 0 ? Math.round(ms / 60000) : 0;
}

function hhmm(d) {
  const t = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(t.getHours())}:${p(t.getMinutes())}`;
}

// 삼성 헬스(Health Connect) 걸음·운동 패널 — 달력에서 선택한 날짜(date)의 데이터를 보여줍니다.
export default function HealthConnectPanel({ date, isToday }) {
  const [available, setAvailable] = useState(null); // null=확인중, false, true
  const [connected, setConnected] = useState(false); // 권한 요청 후 연동됨
  const [status, setStatus] = useState('idle'); // idle | loading | ok | error
  const [steps, setSteps] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [error, setError] = useState('');
  const [workoutError, setWorkoutError] = useState(''); // 운동 세션만 별도 실패한 경우

  useEffect(() => {
    let alive = true;
    healthAvailable().then((ok) => alive && setAvailable(ok));
    return () => {
      alive = false;
    };
  }, []);

  // 걸음·운동을 독립적으로 조회한다. 한쪽이 실패해도 다른 쪽은 표시하고,
  // 운동 세션 실패(권한/오류)는 별도 메시지로 구분한다.
  const fetchDay = useCallback(async () => {
    setStatus('loading');
    setError('');
    setWorkoutError('');
    const [sRes, wRes] = await Promise.allSettled([getStepsForDay(date), getWorkoutsForDay(date)]);
    setSteps(sRes.status === 'fulfilled' ? sRes.value : null);
    if (wRes.status === 'fulfilled') {
      setWorkouts(wRes.value);
    } else {
      setWorkouts([]);
      setWorkoutError(wRes.reason?.message || '운동 세션을 불러오지 못했습니다.');
    }
    if (sRes.status === 'rejected' && wRes.status === 'rejected') {
      setStatus('error');
      setError(sRes.reason?.message || '가져오기에 실패했습니다.');
    } else {
      setStatus('ok');
    }
  }, [date]);

  // 연동된 상태에서 선택 날짜(date)가 바뀌면 그 날 데이터를 다시 조회
  useEffect(() => {
    if (connected) fetchDay();
  }, [connected, fetchDay]);

  async function connect() {
    setStatus('loading');
    setError('');
    try {
      const p = await requestPermissions();
      if (!p.steps && !p.workouts) {
        setStatus('error');
        setError('걸음·운동 읽기 권한이 허용되지 않았습니다. Health Connect에서 권한을 확인하세요.');
        return;
      }
      setConnected(true); // 이후 effect가 선택 날짜 데이터를 불러옵니다.
    } catch (e) {
      setStatus('error');
      setError(e?.message || '연동에 실패했습니다.');
    }
  }

  // 웹이거나 확인 중이면 아무것도 표시하지 않음
  if (!isNativePlatform() || available === null) return null;

  // 네이티브인데 Health Connect 미설치/미지원
  if (available === false) {
    return (
      <div style={styles.card}>
        <div style={styles.title}>삼성 헬스 연동</div>
        <p style={styles.hint}>
          Health Connect를 사용할 수 없습니다. 설치 후 삼성 헬스와 동기화하면 걸음·운동을
          가져올 수 있어요.
        </p>
        <button style={styles.ghostBtn} onClick={openHealthConnectStore}>
          Health Connect 설치
        </button>
      </div>
    );
  }

  const dayLabel = isToday
    ? '오늘'
    : (() => {
        const d = new Date(`${date}T00:00:00`);
        return `${d.getMonth() + 1}월 ${d.getDate()}일`;
      })();
  const loading = status === 'loading';

  return (
    <div style={styles.card}>
      <div style={styles.head}>
        <span style={styles.title}>삼성 헬스 · Health Connect</span>
        <button
          style={styles.syncBtn}
          onClick={connected ? fetchDay : connect}
          disabled={loading}
        >
          {loading ? (connected ? '불러오는 중…' : '연동 중…') : connected ? '새로고침' : '연동하기'}
        </button>
      </div>

      {status === 'error' && <p style={styles.error}>{error}</p>}

      {!connected && status !== 'error' && (
        <p style={styles.hint}>
          연동하면 달력에서 선택한 날짜의 걸음 수와 운동 세션을 삼성 헬스(Health Connect)에서
          불러옵니다.
        </p>
      )}

      {connected && status !== 'error' && (
        <>
          <div style={styles.stepsRow}>
            <span style={styles.stepsLabel}>{dayLabel} 걸음 수</span>
            <span style={styles.stepsValue}>
              {loading ? '…' : `${(steps || 0).toLocaleString('ko-KR')}보`}
            </span>
          </div>

          <div style={styles.wLabel}>{dayLabel} 운동</div>
          {loading ? (
            <p style={styles.hint}>불러오는 중…</p>
          ) : workoutError ? (
            <>
              <p style={styles.error}>운동 세션을 불러오지 못했습니다: {workoutError}</p>
              <button style={styles.ghostBtn} onClick={openHealthConnectSettings}>
                Health Connect 권한 설정 열기
              </button>
            </>
          ) : workouts.length === 0 ? (
            <>
              <p style={styles.hint}>
                이 날의 운동 세션이 없습니다. 삼성 헬스의 운동 기록이 Health Connect로 동기화됐는지,
                ‘운동(Exercise)’ 읽기 권한이 허용됐는지 확인하세요.
              </p>
              <button style={styles.ghostBtn} onClick={openHealthConnectSettings}>
                Health Connect 설정 열기
              </button>
            </>
          ) : (
            <ul style={styles.list}>
              {workouts.map((w, i) => (
                <li key={w.id || i} style={styles.item}>
                  <div style={styles.itemLeft}>
                    <span style={styles.wType}>{workoutLabel(w.workoutType)}</span>
                    <span style={styles.wDate}>
                      {hhmm(w.startDate)}~{hhmm(w.endDate)}
                    </span>
                  </div>
                  <span style={styles.wMeta}>
                    {minutesBetween(w.startDate, w.endDate)}분
                    {w.calories ? ` · ${Math.round(w.calories)}kcal` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  card: {
    padding: '16px',
    borderRadius: '14px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    marginBottom: '16px',
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
  },
  title: { fontSize: '14px', fontWeight: 700, color: 'var(--text)' },
  syncBtn: {
    padding: '6px 14px',
    fontSize: '13px',
    fontWeight: 600,
    borderRadius: '8px',
    border: 'none',
    background: 'var(--purple)',
    color: '#fff',
    cursor: 'pointer',
  },
  ghostBtn: {
    marginTop: '10px',
    padding: '9px 14px',
    fontSize: '13px',
    fontWeight: 600,
    borderRadius: '8px',
    border: '1px solid var(--purple-border-strong)',
    background: 'transparent',
    color: 'var(--purple)',
    cursor: 'pointer',
  },
  hint: { fontSize: '12px', color: 'var(--text-faint)', margin: '4px 0 0', lineHeight: 1.5 },
  error: { fontSize: '13px', color: 'var(--danger)', margin: '4px 0 0', lineHeight: 1.5 },
  stepsRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid var(--border-subtle)',
  },
  stepsLabel: { fontSize: '13px', color: 'var(--text-muted)' },
  stepsValue: {
    fontSize: '20px',
    fontWeight: 800,
    color: 'var(--purple)',
    fontVariantNumeric: 'tabular-nums',
  },
  wLabel: { fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', margin: '12px 0 6px' },
  list: { listStyle: 'none', padding: 0, margin: 0 },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid var(--border-subtle)',
  },
  itemLeft: { display: 'flex', flexDirection: 'column', gap: '2px' },
  wType: { fontSize: '14px', fontWeight: 600, color: 'var(--text-body)' },
  wDate: { fontSize: '12px', color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' },
  wMeta: { fontSize: '13px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' },
};
