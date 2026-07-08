// 로또 6/45 · 연금복권 720+ 번호 생성 로직.
// 원본 Spring 백엔드(LotteryService/StatisticsWeights)를 브라우저용으로 1:1 포팅했습니다.
// 서버 없이 기기 안에서 계산하며, 통계 가중치는 내장 스냅샷 + 수동 입력을 합쳐 만든
// "출현 횟수"를 그대로 씁니다. (당첨 확률을 높이지는 않습니다.)

export const LOTTO = 'LOTTO';
export const PENSION = 'PENSION';
export const STRATEGIES = ['HOT', 'COLD', 'BALANCE'];

const LOTTO_MIN = 1;
const LOTTO_MAX = 45;
const LOTTO_PICK_SIZE = 6;
const PENSION_GROUP_MIN = 1;
const PENSION_GROUP_MAX = 5;
const PENSION_SERIAL_LENGTH = 6;

// ---- 난수 ------------------------------------------------------------------
// 보안 난수(원본 SecureRandom 대응). crypto가 없으면 Math.random 으로 폴백.
function secureNextInt(maxExclusive) {
  if (maxExclusive <= 0) return 0;
  const g = globalThis.crypto;
  if (g && g.getRandomValues) {
    // 모듈러 편향 제거
    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
    const buf = new Uint32Array(1);
    let v;
    do {
      g.getRandomValues(buf);
      v = buf[0];
    } while (v >= limit);
    return v % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

// 시드 기반 결정적 난수(생일 추천용). mulberry32.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 난수 소스 추상화: { nextInt(n) => [0,n) }
function secureSource() {
  return { nextInt: (n) => secureNextInt(n) };
}
function seededSource(seed) {
  const rng = mulberry32(seed);
  return { nextInt: (n) => (n <= 0 ? 0 : Math.floor(rng() * n)) };
}

function nextIntInRange(source, minInclusive, maxInclusive) {
  return source.nextInt(maxInclusive - minInclusive + 1) + minInclusive;
}

// ---- 가중치 유틸 (원본 weightedPick 계열) ----------------------------------
// weights: { [number]: count } 형태의 평범한 객체.
function entriesByKeyAsc(weights) {
  return Object.keys(weights)
    .map((k) => [Number(k), weights[k]])
    .sort((a, b) => a[0] - b[0]);
}

function weightedPick(weights) {
  const entries = entriesByKeyAsc(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) return entries.length ? entries[0][0] : 0;
  const cursor = secureNextInt(total) + 1; // [1, total]
  let cumulative = 0;
  for (const [key, w] of entries) {
    cumulative += w;
    if (cursor <= cumulative) return key;
  }
  return entries[0][0];
}

function weightedPickExcluding(weights, excludedSet) {
  const available = {};
  for (const [k, w] of Object.entries(weights)) {
    if (!excludedSet.has(Number(k))) available[k] = w;
  }
  return weightedPick(available);
}

function weightedUniquePickExcluding(weights, size, excluded) {
  const picked = [];
  const excludedList = new Set(excluded);
  let guard = 0;
  while (picked.length < size && guard++ < 10000) {
    const candidate = weightedPick(weights);
    if (!excludedList.has(candidate) && !picked.includes(candidate)) {
      picked.push(candidate);
    }
  }
  return picked;
}

function weightedUniquePick(weights, size) {
  return weightedUniquePickExcluding(weights, size, []);
}

// 로또 번호 전략 가중치: BALANCE=전체, HOT=상위 1/3, COLD=하위 1/3 (원본 strategyWeights)
function strategyWeights(weights, strategy) {
  if (strategy === 'BALANCE') return weights;
  const entries = Object.entries(weights).map(([k, w]) => [Number(k), w]);
  const groupSize = Math.max(1, Math.floor(entries.length / 3));
  entries.sort((a, b) => {
    const byValue = strategy === 'HOT' ? b[1] - a[1] : a[1] - b[1];
    return byValue !== 0 ? byValue : a[0] - b[0];
  });
  const out = {};
  for (const [k, w] of entries.slice(0, groupSize)) out[k] = w;
  return out;
}

// 연금 전략 가중치: COLD 만 반전(max - v + 1), 그 외 그대로 (원본 pensionStrategyWeights)
function pensionStrategyWeights(weights, strategy) {
  if (strategy !== 'COLD') return weights;
  const values = Object.values(weights);
  const max = values.length ? Math.max(...values) : 1;
  const out = {};
  for (const [k, w] of Object.entries(weights)) out[k] = max - w + 1;
  return out;
}

// ---- 티켓 생성 -------------------------------------------------------------
function lottoTicket(numbers, bonus) {
  return { numbers: [...numbers].sort((a, b) => a - b), bonusNumber: bonus };
}
function pensionTicket(group, serial) {
  return { group, serialNumber: serial };
}

function randomLotto(source) {
  const picked = [];
  const seen = new Set();
  let guard = 0;
  while (picked.length < LOTTO_PICK_SIZE + 1 && guard++ < 10000) {
    const n = nextIntInRange(source, LOTTO_MIN, LOTTO_MAX);
    if (!seen.has(n)) {
      seen.add(n);
      picked.push(n);
    }
  }
  return lottoTicket(picked.slice(0, LOTTO_PICK_SIZE), picked[LOTTO_PICK_SIZE]);
}

function randomLottoNumbers(source) {
  const picked = [];
  const seen = new Set();
  let guard = 0;
  while (picked.length < LOTTO_PICK_SIZE && guard++ < 10000) {
    const n = nextIntInRange(source, LOTTO_MIN, LOTTO_MAX);
    if (!seen.has(n)) {
      seen.add(n);
      picked.push(n);
    }
  }
  return picked.sort((a, b) => a - b);
}

function randomBonusNumber(numbers) {
  let bonus;
  do {
    bonus = nextIntInRange(secureSource(), LOTTO_MIN, LOTTO_MAX);
  } while (numbers.includes(bonus));
  return bonus;
}

function randomPension(source) {
  const group = nextIntInRange(source, PENSION_GROUP_MIN, PENSION_GROUP_MAX);
  let serial = '';
  for (let i = 0; i < PENSION_SERIAL_LENGTH; i++) serial += String(source.nextInt(10));
  return pensionTicket(group, serial);
}

// AI 후보용: 자릿수가 모두 다른 연금 번호
function randomUniquePension() {
  const source = secureSource();
  const group = nextIntInRange(source, PENSION_GROUP_MIN, PENSION_GROUP_MAX);
  const digits = [];
  const seen = new Set();
  let guard = 0;
  while (digits.length < PENSION_SERIAL_LENGTH && guard++ < 10000) {
    const d = source.nextInt(10);
    if (!seen.has(d)) {
      seen.add(d);
      digits.push(d);
    }
  }
  return pensionTicket(group, digits.join(''));
}

function weightedLotto(weights, strategy) {
  const numbers =
    strategy === 'BALANCE'
      ? balancedLottoPick(weights)
      : weightedUniquePick(strategyWeights(weights, strategy), LOTTO_PICK_SIZE);
  let bonus;
  do {
    bonus = weightedPick(weights);
  } while (numbers.includes(bonus));
  return lottoTicket(numbers, bonus);
}

function balancedLottoPick(weights) {
  const hot = weightedUniquePick(strategyWeights(weights, 'HOT'), 3);
  const cold = weightedUniquePickExcluding(strategyWeights(weights, 'COLD'), 3, hot);
  return [...hot, ...cold];
}

function weightedPension(groupWeights, digitWeights, strategy) {
  const group = weightedPick(pensionStrategyWeights(groupWeights, strategy));
  const used = new Set();
  let serial = '';
  for (let i = 0; i < PENSION_SERIAL_LENGTH; i++) {
    const digitStrategy =
      strategy === 'BALANCE' ? (i % 2 === 0 ? 'HOT' : 'COLD') : strategy;
    const digit = weightedPickExcluding(pensionStrategyWeights(digitWeights, digitStrategy), used);
    used.add(digit);
    serial += String(digit);
  }
  return pensionTicket(group, serial);
}

// ---- AI 점수 (원본 aiScore / aiPensionScore) --------------------------------
function aiScore(numbers, frequencyWeights) {
  const oddCount = numbers.filter((n) => n % 2 !== 0).length;
  const rangeCount = new Set(numbers.map((n) => Math.floor((n - 1) / 10))).size;
  const endingCount = new Set(numbers.map((n) => n % 10)).size;
  const sum = numbers.reduce((a, b) => a + b, 0);
  let consecutivePairs = 0;
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] - numbers[i - 1] === 1) consecutivePairs++;
  }
  const frequencyScore = Math.floor(
    numbers.reduce((a, n) => a + (frequencyWeights[n] || 0), 0) / LOTTO_PICK_SIZE
  );
  const oddEvenScore = 18 - Math.abs(3 - oddCount) * 8;
  const sumScore = sum >= 100 && sum <= 200 ? 12 : 0;
  return (
    frequencyScore + rangeCount * 5 + endingCount * 2 + oddEvenScore + sumScore - consecutivePairs * 7
  );
}

function aiPensionScore(ticket, groupWeights, digitWeights) {
  const digits = ticket.serialNumber.split('').map((c) => Number(c));
  const frequencyScore = Math.floor(
    digits.reduce((a, d) => a + (digitWeights[d] || 0), 0) / PENSION_SERIAL_LENGTH
  );
  const groupScore = groupWeights[ticket.group] || 0;
  let consecutivePairs = 0;
  for (let i = 1; i < digits.length; i++) {
    if (Math.abs(digits[i] - digits[i - 1]) === 1) consecutivePairs++;
  }
  return frequencyScore + groupScore - consecutivePairs * 4;
}

// ---- 노트 문구 -------------------------------------------------------------
const STRATEGY_NOTE = {
  HOT: '과거 회차에서 자주 나온 번호를 중심으로 생성했습니다. 당첨 확률을 높이지는 않습니다.',
  COLD: '과거 회차에서 적게 나온 번호를 중심으로 생성했습니다. 당첨 확률을 높이지는 않습니다.',
  BALANCE: '자주 나온 번호와 적게 나온 번호를 균형 있게 조합했습니다. 당첨 확률을 높이지는 않습니다.',
};

// 생일 시드: 원본과 같은 의미(생일·오늘·복권종류 조합)를 32비트 해시로.
function birthdaySeed(birthDate, lotteryType) {
  const today = new Date();
  const todayValue = Math.floor(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000
  );
  const birthValue = Math.floor(new Date(birthDate + 'T00:00:00Z').getTime() / 86400000);
  const typeOrd = lotteryType === LOTTO ? 0 : 1;
  // 32비트로 접어 해시
  let h = 2166136261 >>> 0;
  for (const v of [birthValue, todayValue, typeOrd]) {
    h ^= v & 0xffffffff;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---- 공개 API --------------------------------------------------------------
// options: { mode, lotteryType, count, strategy, birthDate }
// weights: { lottoNumbers, pensionGroups, pensionDigits }
export function generate(options, weights) {
  const { mode, lotteryType } = options;
  const count = Math.min(10, Math.max(1, options.count || 1));
  const now = new Date().toISOString();

  if (mode === 'birthday') {
    const source = seededSource(birthdaySeed(options.birthDate, lotteryType));
    const ticket = lotteryType === LOTTO ? randomLotto(source) : randomPension(source);
    return {
      mode: 'BIRTHDAY',
      lotteryType,
      tickets: [ticket],
      note: '생년월일과 오늘 날짜를 기준으로 생성한 추천 번호입니다. 오늘 안에는 같은 번호가 유지됩니다.',
      generatedAt: now,
    };
  }

  if (mode === 'ai') {
    return lotteryType === LOTTO
      ? generateAiLotto(count, weights, now)
      : generateAiPension(count, weights, now);
  }

  // random | statistics
  const strategy = STRATEGIES.includes(options.strategy) ? options.strategy : 'BALANCE';
  const tickets = [];
  for (let i = 0; i < count; i++) {
    if (lotteryType === LOTTO) {
      tickets.push(
        mode === 'random' ? randomLotto(secureSource()) : weightedLotto(weights.lottoNumbers, strategy)
      );
    } else {
      tickets.push(
        mode === 'random'
          ? randomPension(secureSource())
          : weightedPension(weights.pensionGroups, weights.pensionDigits, strategy)
      );
    }
  }
  return {
    mode: mode === 'random' ? 'RANDOM' : 'STATISTICS',
    lotteryType,
    tickets,
    note: mode === 'random' ? '보안 난수로 생성한 번호입니다.' : STRATEGY_NOTE[strategy],
    generatedAt: now,
  };
}

function generateAiLotto(count, weights, now) {
  const freq = weights.lottoNumbers;
  const tickets = [];
  const seen = new Set();
  while (tickets.length < count) {
    let best = null;
    let bestScore = -Infinity;
    for (let attempt = 0; attempt < 120; attempt++) {
      const candidate = randomLottoNumbers(secureSource());
      if (seen.has(candidate.join(','))) continue;
      const score = aiScore(candidate, freq);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    if (!best) best = randomLottoNumbers(secureSource());
    seen.add(best.join(','));
    tickets.push(lottoTicket(best, randomBonusNumber(best)));
  }
  return {
    mode: 'AI',
    lotteryType: LOTTO,
    tickets,
    note: '회차 빈도, 홀짝 비율, 구간 분산, 연속 번호, 끝수 분산을 조합해 점수가 높은 번호를 추천했습니다. 당첨 확률을 높이지는 않습니다.',
    generatedAt: now,
  };
}

function generateAiPension(count, weights, now) {
  const tickets = [];
  const seen = new Set();
  while (tickets.length < count) {
    let best = null;
    let bestScore = -Infinity;
    for (let attempt = 0; attempt < 120; attempt++) {
      const candidate = randomUniquePension();
      const key = candidate.group + ':' + candidate.serialNumber;
      if (seen.has(key)) continue;
      const score = aiPensionScore(candidate, weights.pensionGroups, weights.pensionDigits);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    if (!best) best = randomUniquePension();
    seen.add(best.group + ':' + best.serialNumber);
    tickets.push(best);
  }
  return {
    mode: 'AI',
    lotteryType: PENSION,
    tickets,
    note: '조별 빈도, 자릿수 숫자 빈도, 연속 숫자, 숫자 중복을 함께 고려해 점수가 높은 연금복권 번호를 추천했습니다. 당첨 확률을 높이지는 않습니다.',
    generatedAt: now,
  };
}
