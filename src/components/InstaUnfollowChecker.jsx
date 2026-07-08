import { useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  appendSnapshot,
  classifyByName,
  computeResult,
  diffSnapshots,
  loadSnapshots,
  makeSnapshot,
  readRelations,
  resultFromSnapshot,
  saveSnapshots,
} from '../utils/instaUnfollow';

function fmtDateTime(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 인스타그램 언팔로워(안 맞팔) 확인 — 내 정보 다운로드(JSON) 파일을 기기에서 분석
export default function InstaUnfollowChecker() {
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [changes, setChanges] = useState(null); // 직전 스냅샷과 비교 결과 | null(첫 기록)
  const [tab, setTab] = useState('notBack'); // notBack | fans | changes
  const [query, setQuery] = useState('');
  const [source, setSource] = useState(null); // 'live'(방금 분석) | 'history'(과거 기록) | null
  const [viewingAt, setViewingAt] = useState(null); // history 열람 시 해당 스냅샷 시각
  const inputRef = useRef(null);

  const history = loadSnapshots();

  // 파일명이 아니라 "내용의 키"로 팔로워/팔로잉을 판별해 누적합니다.
  async function collectFromFiles(files) {
    const followers = [];
    const following = [];
    const consume = (text, nameHint) => {
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        return;
      }
      const rel = readRelations(json, nameHint);
      followers.push(...rel.followers);
      following.push(...rel.following);
    };

    for (const file of files) {
      const name = file.name.toLowerCase();
      if (name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file);
        for (const path of Object.keys(zip.files)) {
          const lower = path.toLowerCase();
          if (zip.files[path].dir || !lower.endsWith('.json') || !lower.includes('follow')) {
            continue;
          }
          consume(await zip.files[path].async('string'), classifyByName(path));
        }
      } else if (name.endsWith('.json')) {
        consume(await file.text(), classifyByName(file.name));
      }
    }
    return { followers, following };
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setStatus('loading');
    setError('');
    setResult(null);
    try {
      const { followers, following } = await collectFromFiles(files);
      if (followers.length === 0 && following.length === 0) {
        setStatus('error');
        setError(
          '팔로워·팔로잉 목록을 찾지 못했습니다. 내보내기를 JSON 형식으로 받았는지, ZIP 전체(또는 followers_1.json + following.json)를 선택했는지 확인하세요.'
        );
        return;
      }
      if (following.length === 0) {
        setStatus('error');
        setError('팔로잉(following.json)을 찾지 못했습니다. ZIP에 following 파일이 포함됐는지 확인하세요.');
        return;
      }
      if (followers.length === 0) {
        setStatus('error');
        setError('팔로워(followers_1.json)를 찾지 못했습니다. ZIP에 followers 파일이 포함됐는지 확인하세요.');
        return;
      }
      const res = computeResult(followers, following);
      // 직전 스냅샷과 비교 후, 이번 스냅샷을 기록에 추가
      const prev = loadSnapshots().slice(-1)[0] || null;
      const snapshot = makeSnapshot(followers, following);
      const chg = prev ? diffSnapshots(prev, snapshot) : null;
      appendSnapshot(snapshot);

      setResult(res);
      setChanges(chg);
      setQuery('');
      setSource('live');
      setViewingAt(null);
      setTab(chg && (chg.lostFollowers.length || chg.gainedFollowers.length) ? 'changes' : 'notBack');
      setStatus('done');
    } catch (e) {
      setStatus('error');
      setError(e?.message || '파일을 분석하지 못했습니다. JSON 형식으로 내려받았는지 확인하세요.');
    }
  }

  function reset() {
    setResult(null);
    setChanges(null);
    setStatus('idle');
    setError('');
    setQuery('');
    setSource(null);
    setViewingAt(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  // 저장된 과거 스냅샷의 상세를 재계산해서 보여줍니다(직전 기록과의 변화 포함).
  function openHistory(index) {
    const snaps = loadSnapshots();
    const snap = snaps[index];
    if (!snap) return;
    const prev = index > 0 ? snaps[index - 1] : null;
    setResult(resultFromSnapshot(snap));
    setChanges(prev ? diffSnapshots(prev, snap) : null);
    setQuery('');
    setTab('notBack');
    setSource('history');
    setViewingAt(snap.at);
    setStatus('done');
    setError('');
  }

  function clearHistory() {
    if (!window.confirm('저장된 분석 기록을 모두 삭제할까요? 다음 업로드 시 비교 대상이 없어집니다.')) {
      return;
    }
    saveSnapshots([]);
    setChanges(null);
  }

  const list = result ? (tab === 'notBack' ? result.notFollowingBack : result.fans) : [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? list.filter((u) => u.username.toLowerCase().includes(q)) : list;
  }, [list, query]);

  return (
    <section style={styles.section}>
      {!result && (
        <>
          <div style={styles.guide}>
            <div style={styles.guideTitle}>사용 방법</div>
            <ol style={styles.steps}>
              <li>인스타그램 앱 → 프로필 → ☰ → <b>계정 센터</b> → <b>내 정보 및 권한</b> → <b>내 정보 내보내기</b></li>
              <li>정보 다운로드 요청 → 형식은 반드시 <b>JSON</b> 선택</li>
              <li>이메일로 받은 <b>ZIP</b> 파일(또는 그 안의 <code>followers_1.json</code> + <code>following.json</code>)을 아래에서 선택</li>
            </ol>
            <p style={styles.privacy}>
              🔒 파일은 이 기기 안에서만 분석되며 외부로 업로드되지 않습니다. 비교를 위해
              팔로워·팔로잉 아이디 목록만 이 기기에 저장됩니다.
            </p>
            {history.length > 0 && (
              <p style={styles.privacy}>
                📚 저장된 기록 {history.length}개 · 마지막 {fmtDateTime(history[history.length - 1].at)}{' '}
                <button style={styles.linkBtn} onClick={clearHistory}>
                  기록 초기화
                </button>
              </p>
            )}
          </div>

          <button style={styles.uploadBtn} onClick={() => inputRef.current?.click()}>
            {status === 'loading' ? '분석 중…' : 'ZIP 또는 JSON 파일 선택'}
          </button>
          <input
            ref={inputRef}
            type="file"
            // 안드로이드 WebView는 accept 값을 파일 선택기의 MIME 필터로 넘기는데,
            // 인스타 ZIP은 octet-stream, .json은 미지원으로 잡혀 선택창에서 파일이
            // 회색 처리(선택 불가)되는 경우가 많다. 그래서 필터를 걸지 않고, 선택된
            // 파일은 아래 handleFiles / collectFromFiles 에서 확장자로 검증한다.
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            style={{ display: 'none' }}
          />
          {status === 'error' && <p style={styles.error}>{error}</p>}

          {history.length > 0 && <HistoryList history={history} onOpen={openHistory} />}
        </>
      )}

      {result && (
        <>
          {source === 'history' && (
            <div style={styles.historyBanner}>
              📅 {fmtDateTime(viewingAt)}에 올린 기록입니다
            </div>
          )}
          <div style={styles.statsRow}>
            <Stat label="팔로워" value={result.followersCount} />
            <Stat label="팔로잉" value={result.followingCount} />
            <Stat label="맞팔" value={result.mutualCount} />
          </div>

          <div style={styles.segmented}>
            <button
              onClick={() => setTab('notBack')}
              style={{ ...styles.segBtn, ...(tab === 'notBack' ? styles.segBtnActive : {}) }}
            >
              안 맞팔 {result.notFollowingBack.length}
            </button>
            <button
              onClick={() => setTab('fans')}
              style={{ ...styles.segBtn, ...(tab === 'fans' ? styles.segBtnActive : {}) }}
            >
              나만 안 함 {result.fans.length}
            </button>
            <button
              onClick={() => setTab('changes')}
              style={{ ...styles.segBtn, ...(tab === 'changes' ? styles.segBtnActive : {}) }}
            >
              변화 {changes ? changes.lostFollowers.length : 0}
            </button>
          </div>

          {tab === 'changes' ? (
            <ChangesView changes={changes} onClearHistory={clearHistory} />
          ) : (
            <>
              <p style={styles.tabDesc}>
                {tab === 'notBack'
                  ? '내가 팔로우하지만 나를 팔로우하지 않는 계정'
                  : '나를 팔로우하지만 내가 팔로우하지 않는 계정'}
              </p>

              <input
                type="text"
                value={query}
                placeholder="아이디 검색"
                onChange={(e) => setQuery(e.target.value)}
                style={styles.search}
              />

              {filtered.length === 0 ? (
                <p style={styles.empty}>
                  {query ? '검색 결과가 없습니다.' : '해당하는 계정이 없습니다. 🎉'}
                </p>
              ) : (
                <ul style={styles.list}>
                  {filtered.map((u) => (
                    <UserItem key={u.username} username={u.username} />
                  ))}
                </ul>
              )}
            </>
          )}

          <button style={styles.resetBtn} onClick={reset}>
            {source === 'history' ? '← 기록 목록으로' : '다른 파일 분석'}
          </button>
        </>
      )}
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div style={styles.stat}>
      <div style={styles.statValue}>{value.toLocaleString('ko-KR')}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

// 아이디 한 줄 (프로필 링크). username 은 문자열.
function UserItem({ username, tone }) {
  const color = tone === 'lost' ? 'var(--danger)' : tone === 'gained' ? 'var(--success)' : 'var(--accent-chip-text)';
  const bg = tone === 'lost' ? 'var(--danger-border)' : tone === 'gained' ? 'var(--success-bg)' : 'var(--accent-chip-bg)';
  return (
    <li style={styles.item}>
      <span style={{ ...styles.avatar, background: bg, color }}>
        {username.slice(0, 1).toUpperCase()}
      </span>
      <a
        href={`https://www.instagram.com/${username}`}
        target="_blank"
        rel="noopener noreferrer"
        style={styles.username}
      >
        @{username}
      </a>
      <span style={styles.chev}>↗</span>
    </li>
  );
}

// 직전 분석 대비 변화(나를 언팔한 계정 / 새 팔로워)
function ChangesView({ changes, onClearHistory }) {
  if (!changes) {
    return (
      <p style={styles.empty}>
        이번이 첫 기록입니다. 다음에 다시 업로드하면 이전과 비교해 나를 언팔한 계정을
        보여드려요.
      </p>
    );
  }
  const { lostFollowers, gainedFollowers } = changes;
  return (
    <>
      <p style={styles.tabDesc}>{fmtDateTime(changes.at)} 분석과 비교</p>

      {lostFollowers.length === 0 && gainedFollowers.length === 0 ? (
        <p style={styles.empty}>이전 분석 이후 팔로워 변화가 없습니다.</p>
      ) : (
        <>
          <div style={styles.changeHead}>😢 나를 언팔함 · {lostFollowers.length}</div>
          {lostFollowers.length === 0 ? (
            <p style={styles.miniEmpty}>없음</p>
          ) : (
            <ul style={styles.list}>
              {lostFollowers.map((u) => (
                <UserItem key={u} username={u} tone="lost" />
              ))}
            </ul>
          )}

          <div style={styles.changeHead}>🎉 새 팔로워 · {gainedFollowers.length}</div>
          {gainedFollowers.length === 0 ? (
            <p style={styles.miniEmpty}>없음</p>
          ) : (
            <ul style={styles.list}>
              {gainedFollowers.map((u) => (
                <UserItem key={u} username={u} tone="gained" />
              ))}
            </ul>
          )}
        </>
      )}

      <button style={styles.linkBtn} onClick={onClearHistory}>
        기록 초기화
      </button>
    </>
  );
}

// 이전 분석 기록 목록 (최신순). 각 항목을 누르면 그때의 상세를 다시 볼 수 있습니다.
function HistoryList({ history, onOpen }) {
  const indices = history.map((_, i) => i).reverse();
  return (
    <div style={styles.historySection}>
      <div style={styles.historyTitle}>이전 분석 기록 · {history.length}개</div>
      <ul style={styles.list}>
        {indices.map((i) => {
          const snap = history[i];
          return (
            <li key={`${snap.at}-${i}`}>
              <button style={styles.historyRow} onClick={() => onOpen(i)}>
                <span style={styles.historyMeta}>
                  <span style={styles.historyDate}>{fmtDateTime(snap.at)}</span>
                  <span style={styles.historyCounts}>
                    팔로워 {snap.followers.length} · 팔로잉 {snap.following.length}
                  </span>
                </span>
                <span style={styles.chev}>›</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const styles = {
  section: { marginBottom: '28px', wordBreak: 'keep-all' },
  historyBanner: {
    padding: '10px 12px',
    borderRadius: '10px',
    background: 'var(--accent-chip-bg)',
    color: 'var(--accent-chip-text)',
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '14px',
  },
  historySection: { marginTop: '20px' },
  historyTitle: { fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginBottom: '10px' },
  historyRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    cursor: 'pointer',
    textAlign: 'left',
  },
  historyMeta: { display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 },
  historyDate: { fontSize: '14px', fontWeight: 600, color: 'var(--text)' },
  historyCounts: { fontSize: '12px', color: 'var(--text-muted)' },
  guide: {
    padding: '16px',
    borderRadius: '14px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    marginBottom: '14px',
  },
  guideTitle: { fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' },
  steps: { margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--text-body)', lineHeight: 1.7 },
  privacy: { fontSize: '12px', color: 'var(--text-muted)', margin: '12px 0 0', lineHeight: 1.5 },
  uploadBtn: {
    width: '100%',
    padding: '14px',
    fontSize: '15px',
    fontWeight: 700,
    borderRadius: '12px',
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    cursor: 'pointer',
  },
  error: { fontSize: '13px', color: 'var(--danger)', marginTop: '12px', lineHeight: 1.5 },
  statsRow: { display: 'flex', gap: '10px', marginBottom: '14px' },
  stat: {
    flex: 1,
    padding: '12px',
    borderRadius: '12px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    textAlign: 'center',
  },
  statValue: {
    fontSize: '20px',
    fontWeight: 800,
    color: 'var(--text)',
    fontVariantNumeric: 'tabular-nums',
  },
  statLabel: { fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' },
  segmented: {
    display: 'flex',
    gap: '6px',
    padding: '4px',
    borderRadius: '10px',
    background: 'var(--surface-3)',
  },
  segBtn: {
    flex: 1,
    padding: '9px 0',
    fontSize: '13px',
    fontWeight: 600,
    borderRadius: '8px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  segBtnActive: {
    background: 'var(--surface)',
    color: 'var(--accent)',
    boxShadow: '0 1px 3px var(--shadow)',
  },
  tabDesc: { fontSize: '12px', color: 'var(--text-faint)', margin: '10px 0' },
  changeHead: { fontSize: '13px', fontWeight: 700, color: 'var(--text)', margin: '14px 0 6px' },
  miniEmpty: { fontSize: '13px', color: 'var(--text-faint)', margin: '0 0 6px' },
  linkBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
    marginTop: '14px',
    textDecoration: 'underline',
  },
  search: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    marginBottom: '10px',
  },
  empty: { color: 'var(--text-faint)', fontSize: '14px', textAlign: 'center', padding: '24px 0' },
  list: { listStyle: 'none', padding: 0, margin: 0 },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 4px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'var(--accent-chip-bg)',
    color: 'var(--accent-chip-text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 700,
    flexShrink: 0,
  },
  username: {
    flex: 1,
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text)',
    textDecoration: 'none',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chev: { fontSize: '14px', color: 'var(--text-faint)', flexShrink: 0 },
  resetBtn: {
    width: '100%',
    marginTop: '16px',
    padding: '11px',
    fontSize: '14px',
    fontWeight: 600,
    borderRadius: '10px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text-body)',
    cursor: 'pointer',
  },
};
