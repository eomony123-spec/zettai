export type NumbersDrawRow = {
  drawNo: number;
  drawDate: string;
  numbers3: number[];
  numbers4: number[];
};

export type NumbersPredictionGroups = {
  modelName: string;
  recentCount: number;
  primary: number[][];
  secondary: number[][];
  reserve: number[][];
};

type RepeatCategory =
  | "all-different"
  | "one-pair"
  | "two-pair"
  | "three-kind"
  | "four-kind";

type PreparedStats = {
  latest: number[];
  positionCounts: number[][];
  trendCounts: number[][];
  sumCounts: number[];
  diffCounts: number[][];
  repeatCounts: Record<RepeatCategory, number>;
  candidateCount: number;
  sumRange: { min: number; max: number };
};

const LAMBDA = 0.96;
const EPSILON = 1;
const TOP_POOL_LIMIT = 120;

const getTargetDigits = (row: NumbersDrawRow, digitsLength: number) =>
  digitsLength === 4 ? row.numbers4 : row.numbers3;

const createMatrix = (rows: number, columns: number, fill = 0) =>
  Array.from({ length: rows }, () => Array(columns).fill(fill));

const logProbability = (value: number, total: number) =>
  Math.log((value + EPSILON) / (total + EPSILON));

const getRepeatCategory = (digits: number[]): RepeatCategory => {
  const counts = Array.from(
    digits.reduce((map, digit) => {
      map.set(digit, (map.get(digit) ?? 0) + 1);
      return map;
    }, new Map<number, number>()).values()
  ).sort((a, b) => b - a);

  if (counts[0] === 4) return "four-kind";
  if (counts[0] === 3) return "three-kind";
  if (counts[0] === 2 && counts[1] === 2) return "two-pair";
  if (counts[0] === 2) return "one-pair";
  return "all-different";
};

const getDiffBucket = (value: number) => {
  if (value === 0) return 0;
  if (value <= 3) return 1;
  if (value <= 6) return 2;
  return 3;
};

const buildSumRange = (rows: number[][]) => {
  const sums = rows.map((digits) => digits.reduce((total, value) => total + value, 0));
  const sorted = [...sums].sort((a, b) => a - b);
  const lowerIndex = Math.floor((sorted.length - 1) * 0.15);
  const upperIndex = Math.floor((sorted.length - 1) * 0.85);
  return {
    min: sorted[Math.max(0, lowerIndex)] ?? 0,
    max: sorted[Math.max(0, upperIndex)] ?? 9 * (rows[0]?.length ?? 4)
  };
};

const prepareStats = (
  rows: NumbersDrawRow[],
  digitsLength: number,
  requestedCount: number
): PreparedStats => {
  const recentRows = rows.slice(0, requestedCount);
  if (recentRows.length === 0) {
    throw new Error("No rows available.");
  }

  const digitRows = recentRows.map((row) => getTargetDigits(row, digitsLength));
  const positionCounts = createMatrix(digitsLength, 10);
  const trendCounts = createMatrix(digitsLength, 10);
  const sumCounts = Array(9 * digitsLength + 1).fill(0);
  const diffCounts = createMatrix(digitsLength, 4);
  const repeatCounts: Record<RepeatCategory, number> = {
    "all-different": 0,
    "one-pair": 0,
    "two-pair": 0,
    "three-kind": 0,
    "four-kind": 0
  };

  digitRows.forEach((digits, index) => {
    digits.forEach((digit, position) => {
      positionCounts[position][digit] += 1;
    });

    const trendWeight = Math.pow(LAMBDA, index);
    if (index < 30) {
      digits.forEach((digit, position) => {
        trendCounts[position][digit] += trendWeight;
      });
    }

    const sum = digits.reduce((total, value) => total + value, 0);
    sumCounts[sum] += 1;
    repeatCounts[getRepeatCategory(digits)] += 1;
  });

  for (let index = 0; index < digitRows.length - 1; index += 1) {
    const newer = digitRows[index];
    const older = digitRows[index + 1];
    newer.forEach((digit, position) => {
      const diff = Math.abs(digit - older[position]);
      diffCounts[position][getDiffBucket(diff)] += 1;
    });
  }

  return {
    latest: digitRows[0],
    positionCounts,
    trendCounts,
    sumCounts,
    diffCounts,
    repeatCounts,
    candidateCount: digitRows.length,
    sumRange: buildSumRange(digitRows)
  };
};

const hasAcceptableOddEvenBalance = (digits: number[]) => {
  const oddCount = digits.filter((digit) => digit % 2 === 1).length;
  const evenCount = digits.length - oddCount;
  return Math.abs(oddCount - evenCount) <= 2;
};

const hasAcceptableHighLowBalance = (digits: number[]) => {
  const lowCount = digits.filter((digit) => digit <= 4).length;
  const highCount = digits.length - lowCount;
  return Math.abs(lowCount - highCount) <= 2;
};

const passesShapeFilter = (digits: number[]) => {
  const repeatCategory = getRepeatCategory(digits);
  return repeatCategory !== "four-kind";
};

const scoreCandidate = (digits: number[], stats: PreparedStats) => {
  let positionScore = 0;
  let trendScore = 0;
  let diffScore = 0;

  digits.forEach((digit, position) => {
    const positionTotal = stats.positionCounts[position].reduce((sum, value) => sum + value, 0);
    const trendTotal = stats.trendCounts[position].reduce((sum, value) => sum + value, 0);
    positionScore += logProbability(stats.positionCounts[position][digit], positionTotal);
    trendScore += logProbability(stats.trendCounts[position][digit], trendTotal);

    const diffBucket = getDiffBucket(Math.abs(digit - stats.latest[position]));
    const diffTotal = stats.diffCounts[position].reduce((sum, value) => sum + value, 0);
    diffScore += logProbability(stats.diffCounts[position][diffBucket], diffTotal);
  });

  const sum = digits.reduce((total, value) => total + value, 0);
  const sumScore = logProbability(
    stats.sumCounts[sum] ?? 0,
    stats.sumCounts.reduce((total, value) => total + value, 0)
  );

  const repeatCategory = getRepeatCategory(digits);
  const repeatScore = logProbability(
    stats.repeatCounts[repeatCategory],
    Object.values(stats.repeatCounts).reduce((total, value) => total + value, 0)
  );

  return 0.4 * positionScore + 0.2 * trendScore + 0.15 * sumScore + 0.15 * diffScore + 0.1 * repeatScore;
};

const enumerateCandidates = (digitsLength: number) => {
  const max = 10 ** digitsLength;
  const candidates: number[][] = [];

  for (let value = 0; value < max; value += 1) {
    const digits = value
      .toString()
      .padStart(digitsLength, "0")
      .split("")
      .map((digit) => Number.parseInt(digit, 10));
    candidates.push(digits);
  }

  return candidates;
};

const filterCandidates = (ranked: number[][], stats: PreparedStats) => {
  const filtered = ranked.filter((digits) => {
    const sum = digits.reduce((total, value) => total + value, 0);
    return (
      sum >= stats.sumRange.min &&
      sum <= stats.sumRange.max &&
      hasAcceptableOddEvenBalance(digits) &&
      hasAcceptableHighLowBalance(digits) &&
      passesShapeFilter(digits)
    );
  });

  return filtered.length >= 20 ? filtered : ranked;
};

const secureRandomFloat = () => {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] / 0x100000000;
};

const weightedPickIndex = (weights: number[]) => {
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  let threshold = secureRandomFloat() * totalWeight;

  for (let index = 0; index < weights.length; index += 1) {
    threshold -= weights[index];
    if (threshold <= 0) return index;
  }

  return weights.length - 1;
};

const pickDiverseCandidates = (
  ranked: { digits: number[]; score: number }[],
  count: number
) => {
  const pool = [...ranked];
  const selected: number[][] = [];

  while (selected.length < count && pool.length > 0) {
    const weights = pool.map((item, index) => {
      const rankWeight = (pool.length - index) / pool.length;
      const scoreWeight = Math.exp(item.score - pool[0].score);
      return rankWeight * scoreWeight;
    });
    const pickedIndex = weightedPickIndex(weights);
    selected.push(pool[pickedIndex].digits);
    pool.splice(pickedIndex, 1);
  }

  return selected;
};

export const buildNumbersPredictions = (
  rows: NumbersDrawRow[],
  digitsLength: number,
  recentCount: number
): NumbersPredictionGroups => {
  const stats = prepareStats(rows, digitsLength, recentCount);
  const ranked = enumerateCandidates(digitsLength)
    .map((digits) => ({ digits, score: scoreCandidate(digits, stats) }))
    .sort((a, b) => b.score - a.score);

  const filteredPool = filterCandidates(
    ranked.map((item) => item.digits),
    stats
  );
  const filteredSet = new Set(filteredPool.map((digits) => digits.join("")));
  const weightedPool = ranked
    .filter((item) => filteredSet.has(item.digits.join("")))
    .slice(0, TOP_POOL_LIMIT);
  const selected = pickDiverseCandidates(
    weightedPool.length >= 20 ? weightedPool : ranked.slice(0, TOP_POOL_LIMIT),
    20
  );

  return {
    modelName: "干渉モデル",
    recentCount,
    primary: selected.slice(0, 5),
    secondary: selected.slice(5, 15),
    reserve: selected.slice(15, 20)
  };
};
