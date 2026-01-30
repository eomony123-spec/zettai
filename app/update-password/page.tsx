"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isSupabaseReady, supabase } from "../../lib/supabase/client";

const formatAuthError = (message: string) => {
  if (message.includes("Password should be at least")) {
    return "パスワードが短すぎます。6文字以上で設定してください。";
  }
  return `更新エラー: ${message}`;
};

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession();
  }, []);

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) {
      setError("認証設定が未完了です。しばらく待ってから再読み込みしてください。");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");

    const { error: updateError } = await supabase.auth.updateUser({
      password
    });

    if (updateError) {
      setError(formatAuthError(updateError.message));
      setLoading(false);
      return;
    }

    setNotice("パスワードを更新しました。ログインしてください。");
    setLoading(false);
  };

  return (
    <main className="page">
      <section className="card narrow">
        <h1 className="title">新しいパスワード</h1>
        {!isSupabaseReady ? (
          <p className="error">認証設定が未完了です。</p>
        ) : null}
        <form className="form" onSubmit={handleUpdate}>
          <label>
            新しいパスワード
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="********"
              required
              minLength={6}
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          {notice ? <p className="notice">{notice}</p> : null}
          <button className="btn gold" type="submit" disabled={loading || !isSupabaseReady}>
            {loading ? "更新中..." : "パスワードを更新"}
          </button>
        </form>
        <p className="muted">
          <Link href="/login">ログインへ</Link>
        </p>
      </section>
    </main>
  );
}
