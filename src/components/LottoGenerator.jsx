import { useMemo, useState } from 'react';
import { generate, LOTTO, PENSION } from '../utils/lotto';
import {
  addDraw,
  addGeneration,
  clearGenHistory,
  computeWeights,
  fetchNewDraws,
  latestKnownDrawNo,
  loadExtraDraws,
  loadGenHistory,
  lottoFrequencyList,
  removeDraw,
  removeGeneration,
  snapshotInfo,
} from '../utils/lottoStore';

const MODES = [
  { id: 'random', label: '랜덤 뽑기' },
  { id: 'statistics', label: '통계 기반' },
  { id: 'birthday', label: '생일 추천' },
  { id: 'ai', label: 'AI 추천' },
];

const STRATEGY_OPTS = [
  { id: 'HOT', label: '핫넘버' },
  { id: 'COLD', label: '콜드넘버' },
  { id: 'BALANCE', label: '밸런스' },
];

const AI_CRITERIA = {
  [LOTTO]: ['회차 빈도', '홀짝 균형', '구간 분산', '연속 번호', '끝수 분산'],
  [PENSION]: ['조별 빈도', '자릿수 빈도', '연속 숫자', '숫자 중복 방지'],
};

const MODE_LABEL = { RANDOM: '랜덤', STATISTICS: '통계', BIRTHDAY: '생일', AI: 'AI' };

// 한국 로또 공 색상(번호 구간별)
function ballColor(n) {
  if (n <= 10) return { bg: '#fbc400', fg: '#5a4a00' };
  if (n <= 20) return { bg: '#69c8f2', fg: '#0b3a4d' };
  if (n <= 30) return { bg: '#ff7272', fg: '#5a0000' };
  if (n <= 40) return { bg: '#aaaaaa', fg: '#222' };
  return { bg: '#b0d840', fg: '#2c3d00' };
}

function fmtDateTime(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function LottoGenerator() {
  const [mode, setMode] = useState('random');
  const [lotteryType, setLotteryType] = useState(LOTTO);
  const [strategy, setStrategy] = useState('BALANCE');
  const [birthDate, setBirthDate] = useState('');
  const [count, setCount] = useState(5);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [dataVersion, setDataVersion] = useState(0); // 추가 회차 변경 시 통계 재계산 트리거
  const [showData, setShowData] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [histVersion, setHistVersion] = useState(0); // 생성 기록 변경 시 목록 갱신

  const history = useMemo(() => loadGenHistory(), [histVersion]);

  const stats = useMemo(() => computeWeights(), [dataVersion]);
  const info = useMemo(() => snapshotInfo(), []);

  function bumpData() {
    setDataVersion((v) => v + 1);
  }

  function handleGenerate() {
    setError('');
    if (mode === 'birthday' && !birthDate) {
      setError('생년월일을 입력해 주세요.');
      return;
    }
    try {
      const res = generate({ mode, lotteryType, count, strategy, birthDate }, stats.weights);
      setResult(res);
      addGeneration(res);
      setHistVersion((v) => v + 1);
    } catch (e) {
      setError(e?.message || '번호 생성 중 오류가 발생했습니다.');
    }
  }

  async function handleFetch() {
    setFetching(true);
    setFetchMsg('');
    try {
      const added = await fetchNewDraws();
      const total = added.lotto + added.pension;
      bumpData();
      setFetchMsg(
        total === 0
          ? '이미 최신입니다. 새 회차가 없습니다.'
          : `새 회차 반영 완료 — 로또 ${added.lotto}회, 연금복권 ${added.pension}회 추가`
      );
    } catch (e) {
      setFetchMsg(`불러오기 실패: ${e?.message || '네트워크 오류'} (기기에서만 동작합니다)`);
    } finally {
      setFetching(false);
    }
  }

  const totalDraws = lotteryType === LOTTO ? stats.lottoTotalDraws : stats.pensionTotalDraws;

  return (
    <section style={styles.section}>
      {/* 모드 선택 */}
      <div style={styles.segmented}>
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setResult(null); }}
            style={{ ...styles.segBtn, ...(mode === m.id ? styles.segBtnActive : {}) }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* 복권 종류 */}
      <div style={styles.typeRow}>
        {[{ id: LOTTO, label: '로또 6/45' }, { id: PENSION, label: '연금복권 720+' }].map((t) => (
          <button
            key={t.id}
            onClick={() => { setLotteryType(t.id); setResult(null); }}
            style={{ ...styles.typeBtn, ...(lotteryType === t.id ? styles.typeBtnActive : {}) }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 조건 컨트롤 */}
      <div style={styles.controls}>
        {mode !== 'birthday' && (
          <label style={styles.countLabel}>
            <span>생성 개수</span>
            <div style={styles.countRow}>
              <input
                type="range"
                min={1}
                max={10}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <output style={styles.countOut}>{count}개</output>
            </div>
          </label>
        )}
        {mode === 'birthday' && (
          <label style={styles.countLabel}>
            <span>생년월일</span>
            <input
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              style={styles.dateInput}
            />
          </label>
        )}
        {mode === 'statistics' && (
          <div style={styles.strategyRow}>
            {STRATEGY_OPTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setStrategy(s.id)}
                style={{ ...styles.stratBtn, ...(strategy === s.id ? styles.stratBtnActive : {}) }}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        {mode === 'ai' && (
          <div style={styles.criteria}>
            {AI_CRITERIA[lotteryType].map((c) => (
              <span key={c} style={styles.criteriaChip}>{c}</span>
            ))}
          </div>
        )}
      </div>

      <button style={styles.generateBtn} onClick={handleGenerate}>
        번호 생성
      </button>
      {error && <p style={styles.error}>{error}</p>}

      {/* 결과 */}
      {result && (
        <div style={styles.resultArea}>
          <div style={styles.resultHead}>
            <span>{result.note}</span>
            <time>{fmtDateTime(result.generatedAt)}</time>
          </div>
          {result.tickets.map((t, i) => (
            <article key={i} style={styles.ticket}>
              <span style={styles.ticketIdx}>#{i + 1}</span>
              {result.lotteryType === LOTTO ? <LottoTicket ticket={t} /> : <PensionTicket ticket={t} />}
            </article>
          ))}
        </div>
      )}

      {/* 통계 */}
      <div style={styles.statsHead}>
        <div style={styles.eyebrow}>출현 통계</div>
        <span style={styles.drawCount}>{totalDraws.toLocaleString('ko-KR')}회차 반영</span>
      </div>
      {lotteryType === LOTTO ? (
        <LottoStats numbers={stats.weights.lottoNumbers} />
      ) : (
        <PensionStats positionDigits={stats.positionDigits} groups={stats.pensionGroupsView} />
      )}

      {/* 회차 데이터 관리 */}
      <button style={styles.dataToggle} onClick={() => setShowData((v) => !v)}>
        {showData ? '▲ 회차 데이터 닫기' : '▼ 회차 데이터 · 자동 불러오기 / 수동 입력'}
      </button>
      {showData && (
        <DataPanel
          info={info}
          fetching={fetching}
          fetchMsg={fetchMsg}
          onFetch={handleFetch}
          onChanged={bumpData}
        />
      )}

      {/* 생성 기록 */}
      <button style={styles.dataToggle} onClick={() => setShowHistory((v) => !v)}>
        {showHistory ? '▲ 생성 기록 닫기' : `▼ 생성 기록${history.length ? ` · ${history.length}건` : ''}`}
      </button>
      {showHistory && (
        <GenHistory
          history={history}
          onRemove={(id) => { removeGeneration(id); setHistVersion((v) => v + 1); }}
          onClear={() => {
            if (window.confirm('생성 기록을 모두 삭제할까요?')) {
              clearGenHistory();
              setHistVersion((v) => v + 1);
            }
          }}
        />
      )}

      <p style={styles.disclaimer}>
        통계·AI 추천은 재미를 위한 기능이며 당첨 확률을 높이지 않습니다. 모든 계산은 이 기기 안에서만
        이뤄집니다.
      </p>
    </section>
  );
}

function LottoTicket({ ticket }) {
  return (
    <div style={styles.lottoTicket}>
      <div style={styles.balls}>
        {ticket.numbers.map((n) => {
          const c = ballColor(n);
          return (
            <span key={n} style={{ ...styles.ball, background: c.bg, color: c.fg }}>
              {n}
            </span>
          );
        })}
      </div>
      {ticket.bonusNumber != null && (
        <span style={styles.bonus}>
          <b style={{ ...styles.ball, ...styles.bonusBall, ...ballBonusColor(ticket.bonusNumber) }}>
            {ticket.bonusNumber}
          </b>
          보너스
        </span>
      )}
    </div>
  );
}

function ballBonusColor(n) {
  const c = ballColor(n);
  return { background: c.bg, color: c.fg };
}

function PensionTicket({ ticket }) {
  return (
    <div style={styles.pensionTicket}>
      <span style={styles.pensionGroup}>{ticket.group}조</span>
      <span style={styles.pensionSerial}>
        {ticket.serialNumber.split('').map((d, i) => (
          <b key={i} style={styles.pensionDigitBox}>{d}</b>
        ))}
      </span>
    </div>
  );
}

function LottoStats({ numbers }) {
  const list = lottoFrequencyList(numbers);
  const max = list[0]?.appearances || 1;
  return (
    <div style={styles.freqGrid}>
      {list.map((f, i) => {
        const c = ballColor(f.number);
        return (
          <div key={f.number} style={styles.freqRow}>
            <span style={styles.freqRank}>{i + 1}</span>
            <span style={{ ...styles.smallBall, background: c.bg, color: c.fg }}>{f.number}</span>
            <div style={styles.barWrap}>
              <span style={{ ...styles.bar, width: `${Math.max(6, (f.appearances / max) * 100)}%` }} />
            </div>
            <strong style={styles.freqVal}>{f.appearances}회</strong>
          </div>
        );
      })}
    </div>
  );
}

function PensionStats({ positionDigits, groups }) {
  // 전체 숫자 합산
  const totals = Array.from({ length: 10 }, (_, digit) => {
    let sum = 0;
    for (let p = 1; p <= 6; p++) sum += positionDigits[p]?.[digit] || 0;
    return { digit, appearances: sum };
  }).sort((a, b) => b.appearances - a.appearances || a.digit - b.digit);
  const max = totals[0]?.appearances || 1;
  const groupMax = Math.max(...Object.values(groups), 1);

  return (
    <>
      <h4 style={styles.subHead}>조별 출현</h4>
      <div style={styles.freqGrid}>
        {[1, 2, 3, 4, 5].map((g) => (
          <div key={g} style={styles.freqRow}>
            <span style={styles.smallBall}>{g}조</span>
            <div style={styles.barWrap}>
              <span style={{ ...styles.bar, width: `${Math.max(6, (groups[g] / groupMax) * 100)}%` }} />
            </div>
            <strong style={styles.freqVal}>{groups[g]}회</strong>
          </div>
        ))}
      </div>
      <h4 style={styles.subHead}>전체 자릿수 합산</h4>
      <div style={styles.freqGrid}>
        {totals.map((t, i) => (
          <div key={t.digit} style={styles.freqRow}>
            <span style={styles.freqRank}>{i + 1}</span>
            <span style={styles.smallBall}>{t.digit}</span>
            <div style={styles.barWrap}>
              <span style={{ ...styles.bar, width: `${Math.max(6, (t.appearances / max) * 100)}%` }} />
            </div>
            <strong style={styles.freqVal}>{t.appearances}회</strong>
          </div>
        ))}
      </div>
    </>
  );
}

function DataPanel({ info, fetching, fetchMsg, onFetch, onChanged }) {
  const [entryType, setEntryType] = useState(LOTTO);
  const [drawNo, setDrawNo] = useState('');
  const [nums, setNums] = useState('');
  const [bonus, setBonus] = useState('');
  const [group, setGroup] = useState('1');
  const [serial, setSerial] = useState('');
  const [msg, setMsg] = useState('');
  const extra = loadExtraDraws();

  function submitManual() {
    setMsg('');
    const no = parseInt(drawNo, 10);
    if (!no) return setMsg('회차 번호를 입력하세요.');
    if (entryType === LOTTO) {
      const parsed = nums
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number);
      const b = parseInt(bonus, 10);
      if (parsed.length !== 6 || parsed.some((n) => !(n >= 1 && n <= 45)) || new Set(parsed).size !== 6) {
        return setMsg('당첨번호 6개(1~45, 중복 없이)를 입력하세요.');
      }
      if (!(b >= 1 && b <= 45) || parsed.includes(b)) return setMsg('보너스 번호(1~45, 본번호와 다름)를 확인하세요.');
      const r = addDraw(LOTTO, { drawNo: no, numbers: parsed, bonus: b, date: '' });
      if (!r.added) return setMsg(r.reason === 'snapshot' ? '이미 내장된 회차입니다.' : '이미 입력된 회차입니다.');
    } else {
      const g = parseInt(group, 10);
      const s = serial.trim();
      if (!/^[0-9]{6}$/.test(s)) return setMsg('6자리 숫자 일련번호를 입력하세요.');
      const r = addDraw(PENSION, { drawNo: no, group: g, serial: s, date: '' });
      if (!r.added) return setMsg(r.reason === 'snapshot' ? '이미 내장된 회차입니다.' : '이미 입력된 회차입니다.');
    }
    setDrawNo(''); setNums(''); setBonus(''); setSerial('');
    setMsg('추가되었습니다.');
    onChanged();
  }

  function handleRemove(type, no) {
    removeDraw(type, no);
    onChanged();
  }

  return (
    <div style={styles.dataPanel}>
      <p style={styles.dataInfo}>
        📦 내장 통계 기준일 {info.asOf} · 로또 {info.lottoLatest}회 / 연금 {info.pensionLatest}회까지 반영
        <br />현재 최신: 로또 {latestKnownDrawNo(LOTTO)}회 · 연금 {latestKnownDrawNo(PENSION)}회
      </p>

      <button style={styles.fetchBtn} onClick={onFetch} disabled={fetching}>
        {fetching ? '불러오는 중…' : '🔄 새 회차 자동 불러오기'}
      </button>
      {fetchMsg && <p style={styles.fetchMsg}>{fetchMsg}</p>}

      <div style={styles.divider} />
      <div style={styles.entryTypeRow}>
        {[{ id: LOTTO, label: '로또' }, { id: PENSION, label: '연금복권' }].map((t) => (
          <button
            key={t.id}
            onClick={() => setEntryType(t.id)}
            style={{ ...styles.entryTypeBtn, ...(entryType === t.id ? styles.entryTypeBtnActive : {}) }}
          >
            {t.label} 수동 입력
          </button>
        ))}
      </div>

      <input style={styles.input} placeholder="회차 번호" inputMode="numeric" value={drawNo} onChange={(e) => setDrawNo(e.target.value)} />
      {entryType === LOTTO ? (
        <>
          <input style={styles.input} placeholder="당첨번호 6개 (예: 3 11 22 30 41 45)" value={nums} onChange={(e) => setNums(e.target.value)} />
          <input style={styles.input} placeholder="보너스 번호" inputMode="numeric" value={bonus} onChange={(e) => setBonus(e.target.value)} />
        </>
      ) : (
        <>
          <select style={styles.input} value={group} onChange={(e) => setGroup(e.target.value)}>
            {[1, 2, 3, 4, 5].map((g) => <option key={g} value={g}>{g}조</option>)}
          </select>
          <input style={styles.input} placeholder="1등 6자리 (예: 123456)" inputMode="numeric" value={serial} onChange={(e) => setSerial(e.target.value)} />
        </>
      )}
      <button style={styles.addBtn} onClick={submitManual}>추가</button>
      {msg && <p style={styles.fetchMsg}>{msg}</p>}

      {(extra.lotto.length > 0 || extra.pension.length > 0) && (
        <div style={styles.extraList}>
          <div style={styles.subHead}>추가된 회차 (스냅샷 이후)</div>
          {extra.lotto.map((d) => (
            <div key={`l${d.drawNo}`} style={styles.extraItem}>
              <span>로또 {d.drawNo}회 · {d.numbers.join(',')} + {d.bonus} {d.source === 'auto' ? '🔄' : '✍️'}</span>
              <button style={styles.delBtn} onClick={() => handleRemove(LOTTO, d.drawNo)}>삭제</button>
            </div>
          ))}
          {extra.pension.map((d) => (
            <div key={`p${d.drawNo}`} style={styles.extraItem}>
              <span>연금 {d.drawNo}회 · {d.group}조 {d.serial} {d.source === 'auto' ? '🔄' : '✍️'}</span>
              <button style={styles.delBtn} onClick={() => handleRemove(PENSION, d.drawNo)}>삭제</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 내가 생성한 번호 기록 (최신순). 각 항목에 티켓을 그대로 다시 보여준다.
function GenHistory({ history, onRemove, onClear }) {
  if (history.length === 0) {
    return <p style={styles.histEmpty}>아직 생성 기록이 없습니다. 번호를 생성하면 여기에 쌓입니다.</p>;
  }
  return (
    <div style={styles.histPanel}>
      <div style={styles.histTop}>
        <span style={styles.histCount}>{history.length}건 (최근 30건 유지)</span>
        <button style={styles.histClear} onClick={onClear}>전체 삭제</button>
      </div>
      {history.map((h) => (
        <article key={h.id} style={styles.histItem}>
          <div style={styles.histHead}>
            <span style={styles.histBadge}>
              {MODE_LABEL[h.mode] || h.mode} · {h.lotteryType === LOTTO ? '로또' : '연금'}
            </span>
            <time style={styles.histTime}>{fmtDateTime(h.at)}</time>
            <button style={styles.histDel} onClick={() => onRemove(h.id)}>삭제</button>
          </div>
          <div style={styles.histTickets}>
            {h.tickets.map((t, i) => (
              <div key={i} style={styles.histTicketRow}>
                {h.lotteryType === LOTTO ? <LottoTicket ticket={t} /> : <PensionTicket ticket={t} />}
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

const styles = {
  section: { marginBottom: '28px', wordBreak: 'keep-all' },
  histEmpty: { fontSize: '13px', color: 'var(--text-faint)', textAlign: 'center', padding: '18px 0' },
  histPanel: { marginTop: '10px' },
  histTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  histCount: { fontSize: '12px', color: 'var(--text-muted)' },
  histClear: { border: 'none', background: 'transparent', color: 'var(--danger)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: 0 },
  histItem: { padding: '12px', borderRadius: '12px', background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: '8px' },
  histHead: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
  histBadge: { fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: 'var(--accent-chip-bg)', color: 'var(--accent-chip-text)' },
  histTime: { fontSize: '11px', color: 'var(--text-faint)', flex: 1 },
  histDel: { border: 'none', background: 'transparent', color: 'var(--text-faint)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: 0 },
  histTickets: { display: 'flex', flexDirection: 'column', gap: '6px' },
  histTicketRow: { display: 'flex' },
  segmented: { display: 'flex', gap: '6px', padding: '4px', borderRadius: '10px', background: 'var(--surface-3)', marginBottom: '10px' },
  segBtn: { flex: 1, padding: '9px 0', fontSize: '13px', fontWeight: 600, borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' },
  segBtnActive: { background: 'var(--surface)', color: 'var(--accent)', boxShadow: '0 1px 3px var(--shadow)' },
  typeRow: { display: 'flex', gap: '8px', marginBottom: '14px' },
  typeBtn: { flex: 1, padding: '10px', fontSize: '13px', fontWeight: 600, borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-body)', cursor: 'pointer' },
  typeBtnActive: { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-chip-bg)' },
  controls: { marginBottom: '12px' },
  countLabel: { display: 'block', fontSize: '13px', color: 'var(--text-body)', fontWeight: 600 },
  countRow: { display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' },
  countOut: { fontSize: '14px', fontWeight: 700, color: 'var(--accent)', minWidth: '36px', textAlign: 'right' },
  dateInput: { display: 'block', width: '100%', marginTop: '8px', padding: '10px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)' },
  strategyRow: { display: 'flex', gap: '6px' },
  stratBtn: { flex: 1, padding: '9px 0', fontSize: '13px', fontWeight: 600, borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' },
  stratBtnActive: { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-chip-bg)' },
  criteria: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  criteriaChip: { fontSize: '12px', padding: '5px 10px', borderRadius: '999px', background: 'var(--accent-chip-bg)', color: 'var(--accent-chip-text)' },
  generateBtn: { width: '100%', padding: '14px', fontSize: '15px', fontWeight: 700, borderRadius: '12px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' },
  error: { fontSize: '13px', color: 'var(--danger)', marginTop: '10px' },
  resultArea: { marginTop: '16px' },
  resultHead: { display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '11px', color: 'var(--text-faint)', marginBottom: '10px', lineHeight: 1.4 },
  ticket: { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '12px', background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: '8px' },
  ticketIdx: { fontSize: '12px', fontWeight: 700, color: 'var(--text-faint)', flexShrink: 0 },
  lottoTicket: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 },
  balls: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  ball: { width: '32px', height: '32px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, fontVariantNumeric: 'tabular-nums' },
  bonus: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 },
  bonusBall: { boxShadow: '0 0 0 2px var(--surface), 0 0 0 3px var(--border-strong)' },
  pensionTicket: { display: 'flex', alignItems: 'center', gap: '10px', flex: 1 },
  pensionGroup: { fontSize: '15px', fontWeight: 800, color: 'var(--accent)', flexShrink: 0 },
  pensionSerial: { display: 'flex', gap: '4px' },
  pensionDigitBox: { width: '26px', height: '32px', borderRadius: '6px', background: 'var(--surface-3)', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800 },
  statsHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', margin: '22px 0 10px' },
  eyebrow: { fontSize: '15px', fontWeight: 700, color: 'var(--text)' },
  drawCount: { fontSize: '12px', color: 'var(--text-muted)' },
  subHead: { fontSize: '13px', fontWeight: 700, color: 'var(--text-body)', margin: '14px 0 8px' },
  freqGrid: { display: 'flex', flexDirection: 'column', gap: '5px' },
  freqRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  freqRank: { fontSize: '11px', color: 'var(--text-faint)', width: '20px', textAlign: 'right', flexShrink: 0 },
  smallBall: { minWidth: '26px', height: '26px', padding: '0 6px', borderRadius: '13px', background: 'var(--accent-chip-bg)', color: 'var(--accent-chip-text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 },
  barWrap: { flex: 1, height: '8px', borderRadius: '4px', background: 'var(--surface-3)', overflow: 'hidden' },
  bar: { display: 'block', height: '100%', borderRadius: '4px', background: 'var(--accent)' },
  freqVal: { fontSize: '12px', color: 'var(--text-body)', minWidth: '38px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 },
  dataToggle: { width: '100%', marginTop: '20px', padding: '11px', fontSize: '13px', fontWeight: 600, borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-body)', cursor: 'pointer' },
  dataPanel: { marginTop: '10px', padding: '14px', borderRadius: '12px', background: 'var(--surface)', border: '1px solid var(--border)' },
  dataInfo: { fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 12px' },
  fetchBtn: { width: '100%', padding: '11px', fontSize: '14px', fontWeight: 700, borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' },
  fetchMsg: { fontSize: '12px', color: 'var(--text-body)', margin: '8px 0 0', lineHeight: 1.5 },
  divider: { height: '1px', background: 'var(--border-subtle)', margin: '14px 0' },
  entryTypeRow: { display: 'flex', gap: '6px', marginBottom: '10px' },
  entryTypeBtn: { flex: 1, padding: '8px 0', fontSize: '12px', fontWeight: 600, borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' },
  entryTypeBtnActive: { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-chip-bg)' },
  input: { width: '100%', padding: '10px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', marginBottom: '8px', boxSizing: 'border-box' },
  addBtn: { width: '100%', padding: '10px', fontSize: '14px', fontWeight: 700, borderRadius: '8px', border: '1px solid var(--accent)', background: 'var(--accent-chip-bg)', color: 'var(--accent)', cursor: 'pointer' },
  extraList: { marginTop: '12px' },
  extraItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-body)', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' },
  delBtn: { border: 'none', background: 'transparent', color: 'var(--danger)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 },
  disclaimer: { fontSize: '11px', color: 'var(--text-faint)', marginTop: '18px', lineHeight: 1.6 },
};
