import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ORIGINS, TRANSFER_MINUTES } from '../data/gtxSchedule';
import { BUNDANG_DEPARTURES } from '../data/bundangSchedule';
import {
  clockToServiceSeconds,
  computeTimetableConnections,
  formatMinutes,
  nowToServiceSeconds,
} from '../utils/gtxPlanner';
import { fetchDownlineArrivals, formatRemaining } from '../api/seoulSubway';

// 강남구청/선릉 -> (수인분당선) 수서 -> (GTX-A) 동탄 연계 안내
export default function GtxPlanner() {
  const [originId, setOriginId] = useState(ORIGINS[0].id);
  const [mode, setMode] = useState('now'); // 'now' | 'custom'
  const [customTime, setCustomTime] = useState('18:00');
  const [now, setNow] = useState(() => new Date());

  // 현재 시각 1초마다 갱신 (실시간 카운트다운 표시용)
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const origin = ORIGINS.find((o) => o.id === originId) ?? ORIGINS[0];
  const departures = BUNDANG_DEPARTURES[origin.id] ?? [];
  const isNow = mode === 'now';

  // 기준 시각(초). '지금'이면 실시간, '특정 시각'이면 사용자가 고른 시각.
  const baseSeconds = isNow
    ? nowToServiceSeconds(now)
    : clockToServiceSeconds(customTime);

  // 연계 열차 계산 (기준 시각 이후 열차들)
  const rows = useMemo(
    () =>
      computeTimetableConnections(origin, baseSeconds, departures).map((c) => ({
        key: c.trainSeconds,
        depSeconds: c.trainSeconds,
        time: c.trainLabelMinutes,
        rounded: c.hasSeconds,
        gtxDeparture: c.gtxDeparture,
        dongtanArrival: c.dongtanArrival,
      })),
    [origin, baseSeconds, departures]
  );

  // ---- 실시간 도착 정보 (지금 모드에서만, 수동 새로고침) ----
  const [realtime, setRealtime] = useState(null); // { list, fetchedAt } | null
  const [rtError, setRtError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const fetchSeq = useRef(0);

  const loadRealtime = useCallback(async () => {
    const seq = ++fetchSeq.current;
    setRefreshing(true);
    try {
      const list = await fetchDownlineArrivals(origin.name);
      if (seq === fetchSeq.current) {
        setRealtime({ list, fetchedAt: Date.now() });
        setRtError(null);
      }
    } catch (err) {
      if (seq === fetchSeq.current) {
        setRealtime(null);
        setRtError(err.message);
      }
    } finally {
      if (seq === fetchSeq.current) setRefreshing(false);
    }
  }, [origin.name]);

  // 지금 모드 진입/역 변경 시 1회만 조회 (이후 갱신은 새로고침 버튼으로만)
  useEffect(() => {
    if (!isNow) return;
    setRealtime(null);
    setRtError(null);
    loadRealtime();
  }, [isNow, loadRealtime]);

  const rtStatus = !isNow
    ? 'off'
    : rtError
      ? 'error'
      : realtime
        ? 'ok'
        : 'loading';

  const fastest = rows[0];
  const next = rows[1];

  // 실시간 열차의 "예상 도착 절대시각"(조회 시점 기준)과 추천 열차 출발 시각을 ±3분으로 매칭합니다.
  // 조회 시점 기준이라 화면의 1초 갱신과 무관하게 매칭이 안정적입니다.
  // 실시간 API는 대개 몇 정거장 이내 열차만 제공하므로, 먼 열차는 매칭되지 않습니다(정상).
  const fetchServiceSeconds = useMemo(
    () => (realtime ? nowToServiceSeconds(new Date(realtime.fetchedAt)) : null),
    [realtime]
  );

  const { liveForFastest, liveForNext } = useMemo(() => {
    if (!isNow || !realtime) return { liveForFastest: null, liveForNext: null };
    const pool = [...realtime.list];
    const take = (dep) => {
      if (dep == null) return null;
      let bi = -1;
      let bestDiff = 180; // ±3분
      pool.forEach((a, i) => {
        const diff = Math.abs(fetchServiceSeconds + a.etaSeconds - dep);
        if (diff <= bestDiff) {
          bestDiff = diff;
          bi = i;
        }
      });
      return bi >= 0 ? pool.splice(bi, 1)[0] : null;
    };
    return {
      liveForFastest: take(fastest?.depSeconds),
      liveForNext: take(next?.depSeconds),
    };
  }, [isNow, realtime, fetchServiceSeconds, fastest, next]);

  const nowLabel = clockLabel(now);

  return (
    <section style={styles.section}>
      <div style={styles.tabs}>
        {ORIGINS.map((o) => (
          <button
            key={o.id}
            onClick={() => setOriginId(o.id)}
            style={{ ...styles.tab, ...(o.id === originId ? styles.tabActive : {}) }}
          >
            {o.name}
          </button>
        ))}
      </div>

      {/* 기준 시각 선택 */}
      <div style={styles.modeRow}>
        <button
          onClick={() => setMode('now')}
          style={{ ...styles.modeBtn, ...(isNow ? styles.modeActive : {}) }}
        >
          지금
        </button>
        <button
          onClick={() => setMode('custom')}
          style={{ ...styles.modeBtn, ...(!isNow ? styles.modeActive : {}) }}
        >
          특정 시각
        </button>
        <input
          type="time"
          value={customTime}
          onChange={(e) => {
            setCustomTime(e.target.value);
            setMode('custom');
          }}
          style={styles.timeInput}
        />
      </div>

      <p style={styles.meta}>
        {isNow ? `현재 ${nowLabel}` : `기준 ${customTime} (시간표 전용)`} ·{' '}
        {origin.name}→수서 {origin.minutesToSuseo}분 · 환승 {TRANSFER_MINUTES}분
      </p>

      {isNow && (
        <div style={styles.refreshRow}>
          <button
            onClick={loadRealtime}
            disabled={refreshing}
            style={styles.refreshBtn}
          >
            {refreshing ? '새로고침 중…' : '↻ 실시간 새로고침'}
          </button>
          {realtime && (
            <span style={styles.updatedAt}>
              {clockLabel(new Date(realtime.fetchedAt))} 기준
            </span>
          )}
        </div>
      )}

      {fastest ? (
        <>
          <TrainCard
            label="가장 빠른 열차"
            row={fastest}
            baseSeconds={baseSeconds}
            live={liveForFastest}
            rtStatus={rtStatus}
            highlight
          />
          {next ? (
            <TrainCard
              label="다음 열차"
              row={next}
              baseSeconds={baseSeconds}
              live={liveForNext}
              rtStatus={rtStatus}
            />
          ) : (
            <p style={styles.empty}>다음 열차 정보가 없습니다.</p>
          )}
        </>
      ) : (
        <p style={styles.empty}>
          {isNow ? '지금은' : `${customTime}에는`} 연계 가능한 GTX-A 열차가
          없습니다.
        </p>
      )}

      {isNow && <LiveArrivals rtStatus={rtStatus} realtime={realtime} />}
    </section>
  );
}

// 실시간 하행 도착 목록 (추천 매칭과 무관하게 실제 다가오는 열차를 그대로 표시)
function LiveArrivals({ rtStatus, realtime }) {
  const list = realtime?.list ?? [];

  return (
    <div style={styles.livePanel}>
      <div style={styles.livePanelTitle}>실시간 하행 도착 · 수인분당선</div>
      {rtStatus === 'loading' && <div style={styles.liveMuted}>조회 중…</div>}
      {rtStatus === 'error' && <div style={styles.liveMuted}>실시간 정보를 불러오지 못했습니다.</div>}
      {rtStatus === 'ok' &&
        (list.length === 0 ? (
          <div style={styles.liveMuted}>도착 예정 열차가 없습니다.</div>
        ) : (
          <ul style={styles.liveList}>
            {list.slice(0, 3).map((a, i) => (
              <li key={a.btrainNo || i} style={styles.liveItem}>
                <span style={styles.liveDest}>{destOf(a.trainLineNm)}</span>
                <span style={styles.liveStatus}>{a.statusMsg || '운행 중'}</span>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

// "인천행 - 선정릉방면" -> "인천행"
function destOf(trainLineNm) {
  return (trainLineNm || '').split(' - ')[0].trim() || '하행';
}

// 열차 한 편의 연계 정보 카드
function TrainCard({ label, row, baseSeconds, live, rtStatus, highlight }) {
  const scheduleRemain = row.depSeconds - baseSeconds; // 시간표상 남은 초

  return (
    <div style={{ ...styles.card, ...(highlight ? styles.cardHighlight : {}) }}>
      <div style={{ ...styles.cardLabel, ...(highlight ? styles.cardLabelHi : {}) }}>
        {label}
      </div>
      <div style={{ ...styles.cardTime, ...(highlight ? styles.cardTimeHi : {}) }}>
        {formatMinutes(row.time)} 탑승
        {row.rounded && <span style={styles.roundNote}> (30초 열차 올림)</span>}
      </div>

      <div style={styles.remainRow}>
        <span style={styles.badgeSchedule}>
          시간표 {formatRemaining(scheduleRemain)}
        </span>
        <LiveBadge live={live} rtStatus={rtStatus} />
      </div>

      <div style={styles.cardSub}>
        → GTX-A {formatMinutes(row.gtxDeparture)} 탑승 · 동탄{' '}
        {formatMinutes(row.dongtanArrival)} 도착
      </div>
    </div>
  );
}

// 실시간 도착 뱃지 (지금 모드에서만): API 상태 메시지를 그대로 보여줍니다.
// 예) "[3]번째 전역 (왕십리)", "강남구청 도착", "전역 출발"
function LiveBadge({ live, rtStatus }) {
  if (rtStatus === 'off') return null;
  if (live) {
    return (
      <span style={styles.badgeLive}>실시간 · {live.statusMsg || '운행 중'}</span>
    );
  }
  const text =
    rtStatus === 'loading'
      ? '실시간 조회 중…'
      : rtStatus === 'error'
        ? '실시간 오류'
        : '실시간 정보 없음'; // ok이지만 매칭되는 근접 열차 없음
  return <span style={styles.badgeMuted}>{text}</span>;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function clockLabel(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const styles = {
  section: {
    marginBottom: '28px',
    padding: '16px',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    background: 'var(--surface-alt)',
  },
  tabs: { display: 'flex', gap: '8px', marginBottom: '10px' },
  tab: {
    flex: 1,
    padding: '10px 0',
    fontSize: '16px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text-body)',
    cursor: 'pointer',
  },
  tabActive: {
    background: 'var(--accent)',
    borderColor: 'var(--accent)',
    color: '#fff',
    fontWeight: 600,
  },
  modeRow: { display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '10px' },
  modeBtn: {
    padding: '6px 12px',
    fontSize: '13px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text-body)',
    cursor: 'pointer',
  },
  modeActive: { background: 'var(--text)', borderColor: 'var(--text)', color: '#fff' },
  timeInput: {
    marginLeft: 'auto',
    padding: '6px 8px',
    fontSize: '14px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
  },
  meta: { color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 8px' },
  refreshRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  refreshBtn: {
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: 600,
    borderRadius: '8px',
    border: '1px solid var(--accent)',
    background: 'var(--surface)',
    color: 'var(--accent)',
    cursor: 'pointer',
  },
  updatedAt: { fontSize: '12px', color: 'var(--text-faint)' },
  card: {
    padding: '12px 14px',
    borderRadius: '10px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    marginBottom: '10px',
  },
  cardHighlight: { background: 'var(--accent-weak-bg)', borderColor: 'var(--accent-weak-border)' },
  cardLabel: { fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 },
  cardLabelHi: { color: 'var(--accent)' },
  cardTime: { fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '2px 0' },
  cardTimeHi: { fontSize: '24px', color: 'var(--accent-strong)' },
  roundNote: { fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' },
  remainRow: { display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '4px 0 6px' },
  badgeSchedule: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-body)',
    background: 'var(--surface-3)',
    borderRadius: '6px',
    padding: '3px 8px',
  },
  badgeLive: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--success-strong)',
    background: 'var(--success-bg)',
    borderRadius: '6px',
    padding: '3px 8px',
  },
  badgeMuted: {
    fontSize: '12px',
    color: 'var(--text-faint)',
    background: 'var(--surface-3)',
    borderRadius: '6px',
    padding: '3px 8px',
  },
  cardSub: { fontSize: '13px', color: 'var(--text-body)' },
  empty: { color: 'var(--text-faint)', fontSize: '14px', margin: '4px 0 0' },
  livePanel: {
    marginTop: '14px',
    paddingTop: '12px',
    borderTop: '1px dashed var(--border-strong)',
  },
  livePanelTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-body)',
    marginBottom: '8px',
  },
  liveMuted: { fontSize: '13px', color: 'var(--text-faint)' },
  liveList: { listStyle: 'none', padding: 0, margin: 0 },
  liveItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 0',
    borderTop: '1px solid var(--border-subtle)',
    fontSize: '14px',
  },
  liveDest: { fontWeight: 600, color: 'var(--success-strong)', minWidth: '64px' },
  liveStatus: { color: 'var(--text-body)' },
};
