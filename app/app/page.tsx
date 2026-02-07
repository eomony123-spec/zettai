"use client";

import { useEffect, useRef, useState } from "react";

type DrawResult = {
  id: string;
  createdAt: string;
  main: number[];
  bonus?: number;
  mode?: "single" | "wheel";
  wheelPool?: number[];
  wheelTickets?: number[][];
  expertCandidates?: number[];
  randomCandidates?: number[];
};

type NumbersResult = {
  id: string;
  createdAt: string;
  digits: number[];
};

type TrendRuleFlags = {
  recent24: boolean;
  carry: boolean;
  adjacent: boolean;
  lastDigit: boolean;
};

type LotteryRow = {
  drawNo: number;
  drawDate: string;
  main: number[];
  bonus?: number;
};

type LotoModeFlags = {
  expert: boolean;
  random: boolean;
  wheel: boolean;
};

type WheelResult = {
  expertCandidates: number[];
  randomCandidates: number[];
  pool: number[];
  tickets: number[][];
};


const ACCESS_KEY = "zettai-access-granted";
const REQUIRED_PASSWORD = process.env.NEXT_PUBLIC_APP_PASSWORD ?? "";

const LOTO6_HISTORY_KEY = "zettai-draw-history";
const LOTO7_HISTORY_KEY = "zettai-loto7-history";
const MINI_HISTORY_KEY = "zettai-mini-history";
const NUMBERS4_HISTORY_KEY = "zettai-numbers4-history";
const NUMBERS3_HISTORY_KEY = "zettai-numbers3-history";
const MAX_HISTORY = 50;
const LOTO6_RECENT_COUNT = 24;
const LOTO7_RECENT_COUNT = 24;
const LOTO6_POOL_EXPERT_COUNT = 5;
const LOTO6_POOL_RANDOM_COUNT = 7;
const LOTO6_BUCKET_MIN = 3;
const LOTO6_BUCKET_MAX = 5;
const LOTO6_MAX_BIRTHDAY_RANGE = 6;
const LOTO6_MAX_CONSECUTIVE_PAIRS = 1;
const LOTO6_WHEEL_MIN_LINES = 1;
const LOTO6_WHEEL_MAX_LINES = 10;
const LOTO6_MAX_OVERLAP_BETWEEN_LINES = 4;
const LOTO7_POOL_EXPERT_COUNT = 5;
const LOTO7_POOL_RANDOM_COUNT = 7;
const LOTO7_BUCKET_MIN = 3;
const LOTO7_BUCKET_MAX = 5;
const LOTO7_MAX_BIRTHDAY_RANGE = 8;
const LOTO7_MAX_CONSECUTIVE_PAIRS = 2;
const LOTO7_WHEEL_MIN_LINES = 1;
const LOTO7_WHEEL_MAX_LINES = 10;
const LOTO7_MAX_OVERLAP_BETWEEN_LINES = 5;
const FULL_TREND_RULES: TrendRuleFlags = {
  recent24: true,
  carry: true,
  adjacent: true,
  lastDigit: true
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const secureRandomInt = (maxExclusive: number) => {
  if (maxExclusive <= 0) return 0;
  const range = maxExclusive;
  const maxUint = 0xffffffff;
  const limit = maxUint - (maxUint % range);
  const buffer = new Uint32Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return value % range;
};

const generateDraw = (maxNumber: number, mainCount: number) => {
  const pool = Array.from({ length: maxNumber }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = secureRandomInt(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const main = pool.slice(0, mainCount).sort((a, b) => a - b);
  const bonus = pool[mainCount];
  return { main, bonus };
};

const generateNumbers = (length: number) => {
  return Array.from({ length }, () => secureRandomInt(10));
};
const secureRandomFloat = () => {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] / 0x100000000;
};

const generateUniqueNumbers = (
  maxNumber: number,
  count: number,
  excluded: Set<number> = new Set()
) => {
  const available = Array.from({ length: maxNumber }, (_, i) => i + 1).filter(
    (value) => !excluded.has(value)
  );
  for (let i = available.length - 1; i > 0; i -= 1) {
    const j = secureRandomInt(i + 1);
    [available[i], available[j]] = [available[j], available[i]];
  }
  return available.slice(0, Math.min(count, available.length)).sort((a, b) => a - b);
};

const sampleFromPool = (pool: number[], count: number) => {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = secureRandomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count).sort((a, b) => a - b);
};

const parseCsvRow = (line: string) => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current);
  return result.map((value) => value.trim());
};

const parseLotteryCsv = (
  text: string,
  mainCount: number,
  maxNumber: number
): LotteryRow[] => {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const header = parseCsvRow(lines[0]).map((value) => value.replace(/\s/g, ""));
  const drawNoIndex = header.findIndex((value) => value.includes("回"));
  const dateIndex = header.findIndex((value) => value.includes("日"));
  let mainIndices = header
    .map((value, index) => ({ value, index }))
    .filter(
      (item) =>
        item.value.includes("本数字") ||
        item.value.startsWith("数字") ||
        item.value.includes("当選数字")
    )
    .map((item) => item.index);
  let bonusIndex = header.findIndex(
    (value) => value.includes("ボーナス") || value.includes("補助")
  );

  if (mainIndices.length < mainCount) {
    mainIndices = [];
    bonusIndex = -1;
  }

  const rows: LotteryRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const columns = parseCsvRow(lines[i]);
    if (columns.length === 0) continue;

    const drawNo =
      drawNoIndex >= 0 ? parseInt(columns[drawNoIndex], 10) : NaN;
    const drawDate = dateIndex >= 0 ? columns[dateIndex] : "";
    let main: number[] = [];
    let bonus: number | undefined;

    if (mainIndices.length >= mainCount) {
      main = mainIndices
        .slice(0, mainCount)
        .map((index) => parseInt(columns[index], 10))
        .filter((value) => Number.isFinite(value));
      if (bonusIndex >= 0) {
        const parsedBonus = parseInt(columns[bonusIndex], 10);
        if (Number.isFinite(parsedBonus)) bonus = parsedBonus;
      }
    } else {
      const numericIndices = columns
        .map((value, index) => ({
          index,
          value: /^\d+$/.test(value) ? parseInt(value, 10) : null
        }))
        .filter((item) => item.value !== null);
      const numericAfterDate =
        dateIndex >= 0
          ? numericIndices.filter((item) => item.index > dateIndex)
          : numericIndices;
      const selected = numericAfterDate.slice(0, mainCount);
      main = selected.map((item) => item.value as number);
      const bonusCandidate = numericAfterDate[mainCount];
      if (bonusCandidate) bonus = bonusCandidate.value as number;
    }

    if (main.length !== mainCount) continue;
    if (main.some((value) => value < 1 || value > maxNumber)) continue;

    rows.push({
      drawNo: Number.isFinite(drawNo) ? drawNo : rows.length,
      drawDate,
      main,
      bonus
    });
  }

  return rows;
};

const buildCandidateSet = (
  latest: LotteryRow | null,
  recent: LotteryRow[],
  maxNumber: number,
  rules: TrendRuleFlags
) => {
  const candidates = new Set<number>();

  if (rules.recent24 && recent.length > 0) {
    const counts = new Map<number, number>();
    recent.forEach((draw) => {
      draw.main.forEach((value) => {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      });
    });
    counts.forEach((count, value) => {
      if (count >= 3 && count <= 4) candidates.add(value);
    });
  }

  if (!latest) return candidates;

  if (rules.carry) {
    latest.main.forEach((value) => candidates.add(value));
  }

  if (rules.adjacent) {
    latest.main.forEach((value) => {
      if (value > 1) candidates.add(value - 1);
      if (value < maxNumber) candidates.add(value + 1);
    });
  }

  if (rules.lastDigit) {
    const digits = new Set(latest.main.map((value) => value % 10));
    for (let value = 1; value <= maxNumber; value += 1) {
      if (digits.has(value % 10)) candidates.add(value);
    }
  }

  return candidates;
};

const weightedSample = (
  numbers: number[],
  weights: number[],
  count: number
) => {
  const poolNumbers = [...numbers];
  const poolWeights = [...weights];
  const selected: number[] = [];

  for (let i = 0; i < count && poolNumbers.length > 0; i += 1) {
    const total = poolWeights.reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
      selected.push(...poolNumbers.slice(0, count - i));
      break;
    }

    let target = secureRandomFloat() * total;
    let index = 0;
    for (index = 0; index < poolWeights.length; index += 1) {
      target -= poolWeights[index];
      if (target <= 0) break;
    }

    selected.push(poolNumbers[index]);
    poolNumbers.splice(index, 1);
    poolWeights.splice(index, 1);
  }

  return selected;
};

const generateDrawWithRules = (
  maxNumber: number,
  mainCount: number,
  latest: LotteryRow | null,
  recent: LotteryRow[],
  rules: TrendRuleFlags
) => {
  const rulesEnabled =
    rules.recent24 || rules.carry || rules.adjacent || rules.lastDigit;
  if (!rulesEnabled || !latest || recent.length === 0) {
    return generateDraw(maxNumber, mainCount);
  }

  const candidates = buildCandidateSet(latest, recent, maxNumber, rules);
  const numbers = Array.from({ length: maxNumber }, (_, i) => i + 1);
  const weights = numbers.map((value) => (candidates.has(value) ? 3 : 1));
  const main = weightedSample(numbers, weights, mainCount).sort((a, b) => a - b);
  const remaining = numbers.filter((value) => !main.includes(value));
  const bonus = remaining.length
    ? remaining[secureRandomInt(remaining.length)]
    : 0;

  return { main, bonus };
};

const generateExpertCandidates = (
  latest: LotteryRow | null,
  recent: LotteryRow[],
  count: number,
  maxNumber: number
) => {
  if (!latest || recent.length === 0) {
    return generateUniqueNumbers(maxNumber, count);
  }

  const candidates = buildCandidateSet(latest, recent, maxNumber, FULL_TREND_RULES);
  const numbers = Array.from({ length: maxNumber }, (_, i) => i + 1);
  const weights = numbers.map((value) => (candidates.has(value) ? 3 : 1));
  return weightedSample(numbers, weights, count).sort((a, b) => a - b);
};

const countConsecutivePairs = (numbers: number[]) => {
  const sorted = [...numbers].sort((a, b) => a - b);
  let pairs = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] - sorted[i - 1] === 1) pairs += 1;
  }
  return pairs;
};

const countOverlap = (a: number[], b: number[]) => {
  const target = new Set(b);
  return a.reduce((sum, value) => sum + (target.has(value) ? 1 : 0), 0);
};

const passesLoto6PoolChecks = (pool: number[]) => {
  const buckets = [0, 0, 0];
  pool.forEach((value) => {
    if (value <= 14) {
      buckets[0] += 1;
    } else if (value <= 28) {
      buckets[1] += 1;
    } else {
      buckets[2] += 1;
    }
  });

  const bucketBalanced = buckets.every(
    (count) => count >= LOTO6_BUCKET_MIN && count <= LOTO6_BUCKET_MAX
  );
  if (!bucketBalanced) return false;

  const birthdayRangeCount = pool.filter((value) => value <= 31).length;
  if (birthdayRangeCount > LOTO6_MAX_BIRTHDAY_RANGE) return false;

  if (countConsecutivePairs(pool) > LOTO6_MAX_CONSECUTIVE_PAIRS) return false;

  return true;
};

const buildLoto6WheelPool = (latest: LotteryRow | null, recent: LotteryRow[]) => {
  const expertCandidates = generateExpertCandidates(
    latest,
    recent,
    LOTO6_POOL_EXPERT_COUNT,
    43
  );

  let randomCandidates = generateUniqueNumbers(
    43,
    LOTO6_POOL_RANDOM_COUNT,
    new Set(expertCandidates)
  );
  let pool = [...expertCandidates, ...randomCandidates].sort((a, b) => a - b);

  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (passesLoto6PoolChecks(pool)) break;
    randomCandidates = generateUniqueNumbers(
      43,
      LOTO6_POOL_RANDOM_COUNT,
      new Set(expertCandidates)
    );
    pool = [...expertCandidates, ...randomCandidates].sort((a, b) => a - b);
  }

  return {
    expertCandidates,
    randomCandidates,
    pool
  };
};

const buildLoto6WheelTickets = (pool: number[], lines: number) => {
  const lineCount = clamp(lines, LOTO6_WHEEL_MIN_LINES, LOTO6_WHEEL_MAX_LINES);
  const tickets: number[][] = [];
  const usage = new Map<number, number>();
  pool.forEach((value) => usage.set(value, 0));

  for (let i = 0; i < lineCount; i += 1) {
    let best: number[] | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let attempt = 0; attempt < 220; attempt += 1) {
      const ticket = sampleFromPool(pool, 6);
      const signature = ticket.join("-");
      if (tickets.some((item) => item.join("-") === signature)) continue;

      const maxOverlap = tickets.reduce(
        (max, item) => Math.max(max, countOverlap(ticket, item)),
        0
      );
      if (maxOverlap > LOTO6_MAX_OVERLAP_BETWEEN_LINES) continue;

      const usageScore = ticket.reduce(
        (sum, value) => sum + (usage.get(value) ?? 0),
        0
      );
      const overlapScore = tickets.reduce(
        (sum, item) => sum + countOverlap(ticket, item),
        0
      );
      const score = usageScore * 7 + overlapScore * 4 + countConsecutivePairs(ticket);

      if (score < bestScore) {
        best = ticket;
        bestScore = score;
      }
    }

    if (!best) {
      for (let fallback = 0; fallback < 220; fallback += 1) {
        const ticket = sampleFromPool(pool, 6);
        const signature = ticket.join("-");
        if (!tickets.some((item) => item.join("-") === signature)) {
          best = ticket;
          break;
        }
      }
    }

    if (!best) {
      best = sampleFromPool(pool, 6);
    }

    tickets.push(best);
    best.forEach((value) => {
      usage.set(value, (usage.get(value) ?? 0) + 1);
    });
  }

  return tickets;
};

const passesLoto7PoolChecks = (pool: number[]) => {
  const buckets = [0, 0, 0];
  pool.forEach((value) => {
    if (value <= 12) {
      buckets[0] += 1;
    } else if (value <= 24) {
      buckets[1] += 1;
    } else {
      buckets[2] += 1;
    }
  });

  const bucketBalanced = buckets.every(
    (count) => count >= LOTO7_BUCKET_MIN && count <= LOTO7_BUCKET_MAX
  );
  if (!bucketBalanced) return false;

  const birthdayRangeCount = pool.filter((value) => value <= 31).length;
  if (birthdayRangeCount > LOTO7_MAX_BIRTHDAY_RANGE) return false;

  if (countConsecutivePairs(pool) > LOTO7_MAX_CONSECUTIVE_PAIRS) return false;

  return true;
};

const buildLoto7WheelPool = (latest: LotteryRow | null, recent: LotteryRow[]) => {
  const expertCandidates = generateExpertCandidates(
    latest,
    recent,
    LOTO7_POOL_EXPERT_COUNT,
    37
  );

  let randomCandidates = generateUniqueNumbers(
    37,
    LOTO7_POOL_RANDOM_COUNT,
    new Set(expertCandidates)
  );
  let pool = [...expertCandidates, ...randomCandidates].sort((a, b) => a - b);

  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (passesLoto7PoolChecks(pool)) break;
    randomCandidates = generateUniqueNumbers(
      37,
      LOTO7_POOL_RANDOM_COUNT,
      new Set(expertCandidates)
    );
    pool = [...expertCandidates, ...randomCandidates].sort((a, b) => a - b);
  }

  return {
    expertCandidates,
    randomCandidates,
    pool
  };
};

const buildLoto7WheelTickets = (pool: number[], lines: number) => {
  const lineCount = clamp(lines, LOTO7_WHEEL_MIN_LINES, LOTO7_WHEEL_MAX_LINES);
  const tickets: number[][] = [];
  const usage = new Map<number, number>();
  pool.forEach((value) => usage.set(value, 0));

  for (let i = 0; i < lineCount; i += 1) {
    let best: number[] | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let attempt = 0; attempt < 220; attempt += 1) {
      const ticket = sampleFromPool(pool, 7);
      const signature = ticket.join("-");
      if (tickets.some((item) => item.join("-") === signature)) continue;

      const maxOverlap = tickets.reduce(
        (max, item) => Math.max(max, countOverlap(ticket, item)),
        0
      );
      if (maxOverlap > LOTO7_MAX_OVERLAP_BETWEEN_LINES) continue;

      const usageScore = ticket.reduce(
        (sum, value) => sum + (usage.get(value) ?? 0),
        0
      );
      const overlapScore = tickets.reduce(
        (sum, item) => sum + countOverlap(ticket, item),
        0
      );
      const score = usageScore * 7 + overlapScore * 4 + countConsecutivePairs(ticket);

      if (score < bestScore) {
        best = ticket;
        bestScore = score;
      }
    }

    if (!best) {
      for (let fallback = 0; fallback < 220; fallback += 1) {
        const ticket = sampleFromPool(pool, 7);
        const signature = ticket.join("-");
        if (!tickets.some((item) => item.join("-") === signature)) {
          best = ticket;
          break;
        }
      }
    }

    if (!best) {
      best = sampleFromPool(pool, 7);
    }

    tickets.push(best);
    best.forEach((value) => {
      usage.set(value, (usage.get(value) ?? 0) + 1);
    });
  }

  return tickets;
};

export default function DrawPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [runningLoto6, setRunningLoto6] = useState(false);
  const [runningLoto7, setRunningLoto7] = useState(false);
  const [runningMini, setRunningMini] = useState(false);
  const [runningNumbers4, setRunningNumbers4] = useState(false);
  const [runningNumbers3, setRunningNumbers3] = useState(false);
  const [resultLoto6, setResultLoto6] = useState<{
    main: number[];
    bonus: number;
  } | null>(null);
  const [resultLoto6Wheel, setResultLoto6Wheel] =
    useState<WheelResult | null>(null);
  const [resultLoto7, setResultLoto7] = useState<{
    main: number[];
    bonus: number;
  } | null>(null);
  const [resultLoto7Wheel, setResultLoto7Wheel] =
    useState<WheelResult | null>(null);
  const [resultMini, setResultMini] = useState<{
    main: number[];
    bonus: number;
  } | null>(null);
  const [resultNumbers4, setResultNumbers4] = useState<number[] | null>(null);
  const [resultNumbers3, setResultNumbers3] = useState<number[] | null>(null);
  const [historyLoto6, setHistoryLoto6] = useState<DrawResult[]>([]);
  const [historyLoto7, setHistoryLoto7] = useState<DrawResult[]>([]);
  const [historyMini, setHistoryMini] = useState<DrawResult[]>([]);
  const [historyNumbers4, setHistoryNumbers4] = useState<NumbersResult[]>([]);
  const [historyNumbers3, setHistoryNumbers3] = useState<NumbersResult[]>([]);
  const runIdRef = useRef(0);
  const [loto6Modes, setLoto6Modes] = useState<LotoModeFlags>({
    expert: true,
    random: true,
    wheel: true
  });
  const [loto6WheelLines, setLoto6WheelLines] = useState(5);
  const [loto6Data, setLoto6Data] = useState<LotteryRow[]>([]);
  const [loto6Status, setLoto6Status] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [loto6StatusMessage, setLoto6StatusMessage] = useState("");
  const [loto7Modes, setLoto7Modes] = useState<LotoModeFlags>({
    expert: true,
    random: true,
    wheel: true
  });
  const [loto7WheelLines, setLoto7WheelLines] = useState(5);
  const [loto7Data, setLoto7Data] = useState<LotteryRow[]>([]);
  const [loto7Status, setLoto7Status] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [loto7StatusMessage, setLoto7StatusMessage] = useState("");


  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(ACCESS_KEY) === "true") {
      setUnlocked(true);
    }
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    try {
      const rawLoto6 = localStorage.getItem(LOTO6_HISTORY_KEY);
      if (rawLoto6) {
        const parsed = JSON.parse(rawLoto6) as DrawResult[];
        setHistoryLoto6(parsed);
      }
      const rawLoto7 = localStorage.getItem(LOTO7_HISTORY_KEY);
      if (rawLoto7) {
        const parsed = JSON.parse(rawLoto7) as DrawResult[];
        setHistoryLoto7(parsed);
      }
      const rawMini = localStorage.getItem(MINI_HISTORY_KEY);
      if (rawMini) {
        const parsed = JSON.parse(rawMini) as DrawResult[];
        setHistoryMini(parsed);
      }
      const rawNumbers4 = localStorage.getItem(NUMBERS4_HISTORY_KEY);
      if (rawNumbers4) {
        const parsed = JSON.parse(rawNumbers4) as NumbersResult[];
        setHistoryNumbers4(parsed);
      }
      const rawNumbers3 = localStorage.getItem(NUMBERS3_HISTORY_KEY);
      if (rawNumbers3) {
        const parsed = JSON.parse(rawNumbers3) as NumbersResult[];
        setHistoryNumbers3(parsed);
      }
    } catch {
      setHistoryLoto6([]);
      setHistoryLoto7([]);
      setHistoryMini([]);
      setHistoryNumbers4([]);
      setHistoryNumbers3([]);
    }
  }, [unlocked]);
  useEffect(() => {
    if (!unlocked) return;
    let active = true;

    const loadLoto6 = async () => {
      try {
        setLoto6Status("loading");
        setLoto6StatusMessage("");
        const response = await fetch(
          "/.netlify/functions/lottery-csv?game=loto6"
        );
        if (!response.ok) {
          throw new Error("CSV取得に失敗しました。");
        }
        const text = await response.text();
        const rows = parseLotteryCsv(text, 6, 43);
        const sorted = [...rows].sort((a, b) => b.drawNo - a.drawNo);
        if (!active) return;
        setLoto6Data(sorted);
        if (sorted.length === 0) {
          setLoto6Status("error");
          setLoto6StatusMessage("データが見つかりませんでした。");
        } else {
          setLoto6Status("ready");
          setLoto6StatusMessage("");
        }
      } catch (error) {
        if (!active) return;
        setLoto6Status("error");
        setLoto6StatusMessage("直近データを取得できませんでした。");
      }
    };

    loadLoto6();

    return () => {
      active = false;
    };
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked) return;
    let active = true;

    const loadLoto7 = async () => {
      try {
        setLoto7Status("loading");
        setLoto7StatusMessage("");
        const response = await fetch(
          "/.netlify/functions/lottery-csv?game=loto7"
        );
        if (!response.ok) {
          throw new Error("CSV取得に失敗しました。");
        }
        const text = await response.text();
        const rows = parseLotteryCsv(text, 7, 37);
        const sorted = [...rows].sort((a, b) => b.drawNo - a.drawNo);
        if (!active) return;
        setLoto7Data(sorted);
        if (sorted.length === 0) {
          setLoto7Status("error");
          setLoto7StatusMessage("データが見つかりませんでした。");
        } else {
          setLoto7Status("ready");
          setLoto7StatusMessage("");
        }
      } catch (error) {
        if (!active) return;
        setLoto7Status("error");
        setLoto7StatusMessage("直近データを取得できませんでした。");
      }
    };

    loadLoto7();

    return () => {
      active = false;
    };
  }, [unlocked]);

  const handleUnlock = (event: React.FormEvent) => {
    event.preventDefault();
    if (!REQUIRED_PASSWORD) {
      setPasswordError("パスワードが設定されていません。運営に連絡してください。");
      return;
    }
    if (password === REQUIRED_PASSWORD) {
      localStorage.setItem(ACCESS_KEY, "true");
      setUnlocked(true);
      setPasswordError("");
      return;
    }
    setPasswordError("パスワードが違います。");
  };

  const pushHistory = <T,>(
    key: string,
    list: T[],
    setList: (next: T[]) => void,
    nextResult: T
  ) => {
    const next = [nextResult, ...list].slice(0, MAX_HISTORY);
    setList(next);
    localStorage.setItem(key, JSON.stringify(next));
  };

  const toggleLoto6Expert = () => {
    setLoto6Modes((prev) => {
      const expert = !prev.expert;
      const wheel = expert && prev.random;
      return { ...prev, expert, wheel };
    });
  };

  const toggleLoto6Random = () => {
    setLoto6Modes((prev) => {
      const random = !prev.random;
      const wheel = prev.expert && random;
      return { ...prev, random, wheel };
    });
  };

  const toggleLoto6Wheel = () => {
    setLoto6Modes((prev) => {
      if (prev.wheel) {
        return {
          expert: prev.expert,
          random: false,
          wheel: false
        };
      }
      return {
        expert: true,
        random: true,
        wheel: true
      };
    });
  };

  const toggleLoto7Expert = () => {
    setLoto7Modes((prev) => {
      const expert = !prev.expert;
      const wheel = expert && prev.random;
      return { ...prev, expert, wheel };
    });
  };

  const toggleLoto7Random = () => {
    setLoto7Modes((prev) => {
      const random = !prev.random;
      const wheel = prev.expert && random;
      return { ...prev, random, wheel };
    });
  };

  const toggleLoto7Wheel = () => {
    setLoto7Modes((prev) => {
      if (prev.wheel) {
        return {
          expert: prev.expert,
          random: false,
          wheel: false
        };
      }
      return {
        expert: true,
        random: true,
        wheel: true
      };
    });
  };

  const startLoto6 = () => {
    if (runningLoto6) return;
    setRunningLoto6(true);
    setResultLoto6(null);
    setResultLoto6Wheel(null);
    const currentRun = runIdRef.current + 1;
    runIdRef.current = currentRun;

    const total = 800 + secureRandomInt(1200);
    setTimeout(() => {
      if (runIdRef.current !== currentRun) return;
      const latestLoto6 = loto6Data[0] ?? null;
      const recentLoto6 = loto6Data.slice(0, LOTO6_RECENT_COUNT);

      if (loto6Modes.expert && loto6Modes.random && loto6Modes.wheel) {
        const poolResult = buildLoto6WheelPool(latestLoto6, recentLoto6);
        const lines = clamp(
          loto6WheelLines,
          LOTO6_WHEEL_MIN_LINES,
          LOTO6_WHEEL_MAX_LINES
        );
        const tickets = buildLoto6WheelTickets(poolResult.pool, lines);
        const wheelResult: WheelResult = {
          ...poolResult,
          tickets
        };
        const firstTicket = tickets[0] ?? generateDraw(43, 6).main;

        setResultLoto6({ main: firstTicket, bonus: 0 });
        setResultLoto6Wheel(wheelResult);
        setRunningLoto6(false);

        pushHistory(LOTO6_HISTORY_KEY, historyLoto6, setHistoryLoto6, {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          main: firstTicket,
          mode: "wheel",
          wheelPool: wheelResult.pool,
          wheelTickets: wheelResult.tickets,
          expertCandidates: wheelResult.expertCandidates,
          randomCandidates: wheelResult.randomCandidates
        });
        return;
      }

      if (loto6Modes.expert) {
        const next = generateDrawWithRules(
          43,
          6,
          latestLoto6,
          recentLoto6,
          FULL_TREND_RULES
        );
        setResultLoto6(next);
        setRunningLoto6(false);
        pushHistory(LOTO6_HISTORY_KEY, historyLoto6, setHistoryLoto6, {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          main: next.main,
          bonus: next.bonus,
          mode: "single"
        });
        return;
      }

      const randomOnly = generateDraw(43, 6);
      setResultLoto6(randomOnly);
      setRunningLoto6(false);
      pushHistory(LOTO6_HISTORY_KEY, historyLoto6, setHistoryLoto6, {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        main: randomOnly.main,
        bonus: randomOnly.bonus,
        mode: "single"
      });
    }, total);
  };

  const startLoto7 = () => {
    if (runningLoto7) return;
    setRunningLoto7(true);
    setResultLoto7(null);
    setResultLoto7Wheel(null);
    const currentRun = runIdRef.current + 1;
    runIdRef.current = currentRun;

    const total = 800 + secureRandomInt(1200);
    setTimeout(() => {
      if (runIdRef.current !== currentRun) return;
      const latestLoto7 = loto7Data[0] ?? null;
      const recentLoto7 = loto7Data.slice(0, LOTO7_RECENT_COUNT);

      if (loto7Modes.expert && loto7Modes.random && loto7Modes.wheel) {
        const poolResult = buildLoto7WheelPool(latestLoto7, recentLoto7);
        const lines = clamp(
          loto7WheelLines,
          LOTO7_WHEEL_MIN_LINES,
          LOTO7_WHEEL_MAX_LINES
        );
        const tickets = buildLoto7WheelTickets(poolResult.pool, lines);
        const wheelResult: WheelResult = {
          ...poolResult,
          tickets
        };
        const firstTicket = tickets[0] ?? generateDraw(37, 7).main;

        setResultLoto7({ main: firstTicket, bonus: 0 });
        setResultLoto7Wheel(wheelResult);
        setRunningLoto7(false);
        pushHistory(LOTO7_HISTORY_KEY, historyLoto7, setHistoryLoto7, {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          main: firstTicket,
          mode: "wheel",
          wheelPool: wheelResult.pool,
          wheelTickets: wheelResult.tickets,
          expertCandidates: wheelResult.expertCandidates,
          randomCandidates: wheelResult.randomCandidates
        });
        return;
      }

      if (loto7Modes.expert) {
        const next = generateDrawWithRules(
          37,
          7,
          latestLoto7,
          recentLoto7,
          FULL_TREND_RULES
        );
        setResultLoto7(next);
        setRunningLoto7(false);
        pushHistory(LOTO7_HISTORY_KEY, historyLoto7, setHistoryLoto7, {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          main: next.main,
          bonus: next.bonus,
          mode: "single"
        });
        return;
      }

      const randomOnly = generateDraw(37, 7);
      setResultLoto7(randomOnly);
      setRunningLoto7(false);
      pushHistory(LOTO7_HISTORY_KEY, historyLoto7, setHistoryLoto7, {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        main: randomOnly.main,
        bonus: randomOnly.bonus,
        mode: "single"
      });
    }, total);
  };

  const startMini = () => {
    if (runningMini) return;
    setRunningMini(true);
    setResultMini(null);
    const currentRun = runIdRef.current + 1;
    runIdRef.current = currentRun;

    const total = 800 + secureRandomInt(1200);
    setTimeout(() => {
      if (runIdRef.current !== currentRun) return;
      const next = generateDraw(31, 5);
      setResultMini(next);
      setRunningMini(false);
      pushHistory(MINI_HISTORY_KEY, historyMini, setHistoryMini, {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        main: next.main,
        bonus: next.bonus
      });
    }, total);
  };

  const startNumbers4 = () => {
    if (runningNumbers4) return;
    setRunningNumbers4(true);
    setResultNumbers4(null);
    const currentRun = runIdRef.current + 1;
    runIdRef.current = currentRun;

    const total = 600 + secureRandomInt(800);
    setTimeout(() => {
      if (runIdRef.current !== currentRun) return;
      const digits = generateNumbers(4);
      setResultNumbers4(digits);
      setRunningNumbers4(false);
      pushHistory(NUMBERS4_HISTORY_KEY, historyNumbers4, setHistoryNumbers4, {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        digits
      });
    }, total);
  };

  const startNumbers3 = () => {
    if (runningNumbers3) return;
    setRunningNumbers3(true);
    setResultNumbers3(null);
    const currentRun = runIdRef.current + 1;
    runIdRef.current = currentRun;

    const total = 600 + secureRandomInt(800);
    setTimeout(() => {
      if (runIdRef.current !== currentRun) return;
      const digits = generateNumbers(3);
      setResultNumbers3(digits);
      setRunningNumbers3(false);
      pushHistory(NUMBERS3_HISTORY_KEY, historyNumbers3, setHistoryNumbers3, {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        digits
      });
    }, total);
  };

  if (!unlocked) {
    return (
      <main className="page">
        <header className="topbar">
          <div className="decor-row">
            <span className="coin" />
            <span className="block" />
            <span className="block" />
            <span className="coin" />
          </div>
          <h1 className="app-title">天才くん</h1>
          <p className="subtitle">
            宝くじの当選予想を生成する娯楽ツールです。
            <br />
            当選を保証しません。
          </p>
          <div className="pipe-row">
            <span className="pipe" />
            <span className="pipe" />
          </div>
        </header>

        <section className="card narrow">
          <h2 className="title">パスワード入力</h2>
          <form className="form" onSubmit={handleUnlock}>
            <label>
              パスワード
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="********"
                required
              />
            </label>
            {passwordError ? <p className="error">{passwordError}</p> : null}
            <button className="btn gold" type="submit">
              入る
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <div className="decor-row">
          <span className="coin" />
          <span className="block" />
          <span className="block" />
          <span className="coin" />
        </div>
        <h1 className="app-title">天才くん</h1>
        <p className="subtitle">
          宝くじの当選予想を生成する娯楽ツールです。
          <br />
          当選を保証しません。
        </p>
        <div className="pipe-row">
          <span className="pipe" />
          <span className="pipe" />
        </div>
      </header>

      <section className="card" id="loto6">
        <h2 className="title">ロト6 当選予想</h2>
        <div className="rule-panel">
          <div className="rule-list">
            <label className="rule-item">
              <input
                type="checkbox"
                checked={loto6Modes.expert}
                onChange={toggleLoto6Expert}
              />
              達人式
            </label>
            <label className="rule-item">
              <input
                type="checkbox"
                checked={loto6Modes.random}
                onChange={toggleLoto6Random}
              />
              乱数式
            </label>
            <label className="rule-item">
              <input
                type="checkbox"
                checked={loto6Modes.wheel}
                onChange={toggleLoto6Wheel}
              />
              wheel
            </label>
          </div>

          {loto6Modes.wheel ? (
            <div className="wheel-controls">
              <label htmlFor="loto6-wheel-lines">wheel口数</label>
              <input
                id="loto6-wheel-lines"
                type="number"
                min={LOTO6_WHEEL_MIN_LINES}
                max={LOTO6_WHEEL_MAX_LINES}
                value={loto6WheelLines}
                onChange={(event) => {
                  const raw = Number(event.target.value);
                  setLoto6WheelLines(
                    clamp(
                      Number.isFinite(raw) ? raw : LOTO6_WHEEL_MIN_LINES,
                      LOTO6_WHEEL_MIN_LINES,
                      LOTO6_WHEEL_MAX_LINES
                    )
                  );
                }}
              />
            </div>
          ) : null}
        </div>

        <div className="result">
          <div className="numbers">
            {(resultLoto6?.main ?? Array(6).fill("--")).map((value, index) => (
              <span className="ball" key={`${value}-${index}`}>
                {value}
              </span>
            ))}
          </div>

          {resultLoto6Wheel ? (
            <div className="wheel-result">
              <p className="rule-note">
                達人式候補: {resultLoto6Wheel.expertCandidates.join(", ")}
              </p>
              <p className="rule-note">
                乱数式候補: {resultLoto6Wheel.randomCandidates.join(", ")}
              </p>
              <p className="rule-note">
                プール12個: {resultLoto6Wheel.pool.join(", ")}
              </p>
              <div className="wheel-tickets">
                {resultLoto6Wheel.tickets.map((ticket, index) => (
                  <div
                    className="wheel-ticket"
                    key={`wheel-${ticket.join("-")}-${index}`}
                  >
                    {index + 1}口目: {ticket.join(", ")}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="actions">
          <button className="btn" type="button" onClick={startLoto6}>
            {runningLoto6 ? "抽選中..." : "抽選を開始"}
          </button>
        </div>
      </section>

      <section className="card" id="loto7">
        <h2 className="title">ロト7 当選予想</h2>

        <div className="rule-panel">
          <div className="rule-list">
            <label className="rule-item">
              <input
                type="checkbox"
                checked={loto7Modes.expert}
                onChange={toggleLoto7Expert}
              />
              達人式
            </label>
            <label className="rule-item">
              <input
                type="checkbox"
                checked={loto7Modes.random}
                onChange={toggleLoto7Random}
              />
              乱数式
            </label>
            <label className="rule-item">
              <input
                type="checkbox"
                checked={loto7Modes.wheel}
                onChange={toggleLoto7Wheel}
              />
              wheel
            </label>
          </div>

          {loto7Modes.wheel ? (
            <div className="wheel-controls">
              <label htmlFor="loto7-wheel-lines">wheel口数</label>
              <input
                id="loto7-wheel-lines"
                type="number"
                min={LOTO7_WHEEL_MIN_LINES}
                max={LOTO7_WHEEL_MAX_LINES}
                value={loto7WheelLines}
                onChange={(event) => {
                  const raw = Number(event.target.value);
                  setLoto7WheelLines(
                    clamp(
                      Number.isFinite(raw) ? raw : LOTO7_WHEEL_MIN_LINES,
                      LOTO7_WHEEL_MIN_LINES,
                      LOTO7_WHEEL_MAX_LINES
                    )
                  );
                }}
              />
            </div>
          ) : null}
        </div>

        <div className="result">
          <div className="numbers">
            {(resultLoto7?.main ?? Array(7).fill("--")).map((value, index) => (
              <span className="ball" key={`${value}-${index}`}>
                {value}
              </span>
            ))}
          </div>

          {resultLoto7Wheel ? (
            <div className="wheel-result">
              <p className="rule-note">
                達人式候補: {resultLoto7Wheel.expertCandidates.join(", ")}
              </p>
              <p className="rule-note">
                乱数式候補: {resultLoto7Wheel.randomCandidates.join(", ")}
              </p>
              <p className="rule-note">
                プール12個: {resultLoto7Wheel.pool.join(", ")}
              </p>
              <div className="wheel-tickets">
                {resultLoto7Wheel.tickets.map((ticket, index) => (
                  <div
                    className="wheel-ticket"
                    key={`loto7-wheel-${ticket.join("-")}-${index}`}
                  >
                    {index + 1}口目: {ticket.join(", ")}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="actions">
          <button className="btn" type="button" onClick={startLoto7}>
            {runningLoto7 ? "抽選中..." : "抽選を開始"}
          </button>
        </div>
      </section>

      <section className="card" id="mini">
        <h2 className="title">ミニロト 当選予想</h2>

        <div className="result">
          <div className="numbers">
            {(resultMini?.main ?? Array(5).fill("--")).map((value, index) => (
              <span className="ball" key={`${value}-${index}`}>
                {value}
              </span>
            ))}
          </div>
        </div>

        <div className="actions">
          <button className="btn" type="button" onClick={startMini}>
            {runningMini ? "抽選中..." : "抽選を開始"}
          </button>
        </div>
      </section>

      <section className="card" id="numbers4">
        <h2 className="title">ナンバーズ4 当選予想</h2>

        <div className="result">
          <div className="numbers">
            {(resultNumbers4 ?? Array(4).fill("-")).map((value, index) => (
              <span className="ball" key={`${value}-${index}`}>
                {value}
              </span>
            ))}
          </div>
        </div>

        <div className="actions">
          <button className="btn" type="button" onClick={startNumbers4}>
            {runningNumbers4 ? "抽選中..." : "抽選を開始"}
          </button>
        </div>
      </section>

      <section className="card" id="numbers3">
        <h2 className="title">ナンバーズ3 当選予想</h2>

        <div className="result">
          <div className="numbers">
            {(resultNumbers3 ?? Array(3).fill("-")).map((value, index) => (
              <span className="ball" key={`${value}-${index}`}>
                {value}
              </span>
            ))}
          </div>
        </div>

        <div className="actions">
          <button className="btn" type="button" onClick={startNumbers3}>
            {runningNumbers3 ? "抽選中..." : "抽選を開始"}
          </button>
        </div>
      </section>

      <section className="card" id="history">
        <h2 className="title">履歴</h2>
        <p className="muted">最新50件を表示します。</p>
        <div className="history-list">
          <div className="history-group">
            <div className="history-title">ロト6</div>
            {historyLoto6.length === 0 ? (
              <div className="history-item">まだ履歴がありません。</div>
            ) : (
              historyLoto6.map((item) => (
                <div className="history-item" key={item.id}>
                  <div className="history-row">
                    <span className="history-date">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                    <span className="history-main">
                      {item.mode === "wheel" && item.wheelTickets?.length
                        ? item.wheelTickets
                            .map(
                              (ticket, index) =>
                                `${index + 1}口目 ${ticket.join(", ")}`
                            )
                            .join(" / ")
                        : item.main.join(", ")}
                    </span>
                    {item.mode === "wheel" && item.wheelPool ? (
                      <span className="history-sub">
                        pool: {item.wheelPool.join(", ")}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="history-group">
            <div className="history-title">ロト7</div>
            {historyLoto7.length === 0 ? (
              <div className="history-item">まだ履歴がありません。</div>
            ) : (
              historyLoto7.map((item) => (
                <div className="history-item" key={item.id}>
                  <div className="history-row">
                    <span className="history-date">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                    <span className="history-main">
                      {item.mode === "wheel" && item.wheelTickets?.length
                        ? item.wheelTickets
                            .map(
                              (ticket, index) =>
                                `${index + 1}口目 ${ticket.join(", ")}`
                            )
                            .join(" / ")
                        : item.main.join(", ")}
                    </span>
                    {item.mode === "wheel" && item.wheelPool ? (
                      <span className="history-sub">
                        pool: {item.wheelPool.join(", ")}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="history-group">
            <div className="history-title">ミニロト</div>
            {historyMini.length === 0 ? (
              <div className="history-item">まだ履歴がありません。</div>
            ) : (
              historyMini.map((item) => (
                <div className="history-item" key={item.id}>
                  <div className="history-row">
                    <span className="history-date">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                    <span className="history-main">
                      {item.main.join(", ")}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="history-group">
            <div className="history-title">ナンバーズ4</div>
            {historyNumbers4.length === 0 ? (
              <div className="history-item">まだ履歴がありません。</div>
            ) : (
              historyNumbers4.map((item) => (
                <div className="history-item" key={item.id}>
                  <div className="history-row">
                    <span className="history-date">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                    <span className="history-main">
                      {item.digits.join("")}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="history-group">
            <div className="history-title">ナンバーズ3</div>
            {historyNumbers3.length === 0 ? (
              <div className="history-item">まだ履歴がありません。</div>
            ) : (
              historyNumbers3.map((item) => (
                <div className="history-item" key={item.id}>
                  <div className="history-row">
                    <span className="history-date">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                    <span className="history-main">
                      {item.digits.join("")}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}













