"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isSupabaseReady, supabase } from "../../lib/supabase/client";

type DrawResult = {
  id: string;
  createdAt: string;
  main: number[];
  bonus: number;
};

type NumbersResult = {
  id: string;
  createdAt: string;
  digits: number[];
};

const LOTO6_HISTORY_KEY = "zettai-draw-history";
const LOTO7_HISTORY_KEY = "zettai-loto7-history";
const MINI_HISTORY_KEY = "zettai-mini-history";
const NUMBERS4_HISTORY_KEY = "zettai-numbers4-history";
const NUMBERS3_HISTORY_KEY = "zettai-numbers3-history";
const MAX_HISTORY = 50;

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

export default function DrawPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [runningLoto6, setRunningLoto6] = useState(false);
  const [runningLoto7, setRunningLoto7] = useState(false);
  const [runningMini, setRunningMini] = useState(false);
  const [runningNumbers4, setRunningNumbers4] = useState(false);
  const [runningNumbers3, setRunningNumbers3] = useState(false);
  const [resultLoto6, setResultLoto6] = useState<{
    main: number[];
    bonus: number;
  } | null>(null);
  const [resultLoto7, setResultLoto7] = useState<{
    main: number[];
    bonus: number;
  } | null>(null);
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

  useEffect(() => {
    if (!supabase) {
      setCheckingAuth(false);
      return;
    }
    let mounted = true;
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setCheckingAuth(false);
    };

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          router.replace("/login");
        }
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
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
  }, []);

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

  const startLoto6 = () => {
    if (runningLoto6) return;
    setRunningLoto6(true);
    setResultLoto6(null);
    const currentRun = runIdRef.current + 1;
    runIdRef.current = currentRun;

    const total = 800 + secureRandomInt(1200);
    setTimeout(() => {
      if (runIdRef.current !== currentRun) return;
      const next = generateDraw(43, 6);
      setResultLoto6(next);
      setRunningLoto6(false);
      pushHistory(LOTO6_HISTORY_KEY, historyLoto6, setHistoryLoto6, {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        main: next.main,
        bonus: next.bonus
      });
    }, total);
  };

  const startLoto7 = () => {
    if (runningLoto7) return;
    setRunningLoto7(true);
    setResultLoto7(null);
    const currentRun = runIdRef.current + 1;
    runIdRef.current = currentRun;

    const total = 800 + secureRandomInt(1200);
    setTimeout(() => {
      if (runIdRef.current !== currentRun) return;
      const next = generateDraw(37, 7);
      setResultLoto7(next);
      setRunningLoto7(false);
      pushHistory(LOTO7_HISTORY_KEY, historyLoto7, setHistoryLoto7, {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        main: next.main,
        bonus: next.bonus
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

  const handleLogout = async () => {
    await supabase?.auth.signOut();
  };

  if (!isSupabaseReady) {
    return (
      <main className="page">
        <section className="card">
          <p className="error">認証設定が未完了です。</p>
        </section>
      </main>
    );
  }

  if (checkingAuth) {
    return (
      <main className="page">
        <section className="card">
          <p className="muted">認証確認中...</p>
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
        <h1 className="app-title">絶対当たらないくん</h1>
        <p className="subtitle">
          宝くじの当選予想を生成する娯楽ツールです。
          <br />
          当選を保証しません。
        </p>
        <div className="pipe-row">
          <span className="pipe" />
          <span className="pipe" />
        </div>
        <div className="auth-actions">
          <Link className="btn gold" href="/">
            戻る
          </Link>
          <button className="btn" type="button" onClick={handleLogout}>
            ログアウト
          </button>
        </div>
      </header>

      <section className="card" id="loto6">
        <h2 className="title">ロト6 当選予想</h2>

        <div className="result">
          <div className="numbers">
            {(resultLoto6?.main ?? Array(6).fill("--")).map((value, index) => (
              <span className="ball" key={`${value}-${index}`}>
                {value}
              </span>
            ))}
          </div>
        </div>

        <div className="actions">
          <button className="btn" type="button" onClick={startLoto6}>
            {runningLoto6 ? "抽選中..." : "抽選を開始"}
          </button>
        </div>
      </section>

      <section className="card" id="loto7">
        <h2 className="title">ロト7 当選予想</h2>

        <div className="result">
          <div className="numbers">
            {(resultLoto7?.main ?? Array(7).fill("--")).map((value, index) => (
              <span className="ball" key={`${value}-${index}`}>
                {value}
              </span>
            ))}
          </div>
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
                      {item.main.join(", ")}
                    </span>
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
                      {item.main.join(", ")}
                    </span>
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
