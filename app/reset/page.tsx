"use client";

import Link from "next/link";
import { useState } from "react";
import { isSupabaseReady, supabase } from "../../lib/supabase/client";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) {
      setError("認証設定が未完了です。しばらく待ってから再読み込みしてください。");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");

    const redirectTo = `${window.location.origin}/update-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    if (resetError) {
      setError("メールの送信に失敗しました。時間をおいて再度お試しください。");
      setLoading(false);
      return;
    }

    setNotice("再設定メールを送信しました。メールをご確認ください。");
    setLoading(false);
  };

  return (
    <main className="page">
      <section className="card narrow">
        <h1 className="title">パスワード再設定</h1>
        {!isSupabaseReady ? (
          <p className="error">認証設定が未完了です。</p>
        ) : null}
        <form className="form" onSubmit={handleReset}>
          <label>
            メールアドレス
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          {notice ? <p className="notice">{notice}</p> : null}
          <button className="btn gold" type="submit" disabled={loading || !isSupabaseReady}>
            {loading ? "送信中..." : "再設定メールを送る"}
          </button>
        </form>
        <p className="muted">
          <Link href="/login">ログインへ戻る</Link>
        </p>
      </section>
    </main>
  );
}
