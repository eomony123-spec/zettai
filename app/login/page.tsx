"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { isSupabaseReady, supabase } from "../../lib/supabase/client";

const formatAuthError = (message: string) => {
  if (message.includes("Invalid login credentials")) {
    return "メールアドレスまたはパスワードが違います。";
  }
  if (message.includes("Email not confirmed")) {
    return "メール確認が完了していません。確認メールをご確認ください。";
  }
  if (message.includes("User already registered")) {
    return "このメールアドレスは既に登録されています。";
  }
  if (message.includes("Password should be at least")) {
    return "パスワードが短すぎます。6文字以上で設定してください。";
  }
  return `認証エラー: ${message}`;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) {
      setError("認証設定が未完了です。しばらく待ってから再読み込みしてください。");
      return;
    }
    setLoading(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (signInError) {
      setError(formatAuthError(signInError.message));
      setLoading(false);
      return;
    }
    router.push("/app");
  };

  return (
    <main className="page">
      <section className="card narrow">
        <h1 className="title">ログイン</h1>
        {!isSupabaseReady ? (
          <p className="error">認証設定が未完了です。</p>
        ) : null}
        <form className="form" onSubmit={handleLogin}>
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
          <label>
            パスワード
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
          <button className="btn gold" type="submit" disabled={loading || !isSupabaseReady}>
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>
        <p className="muted">
          アカウントがない方は <Link href="/signup">新規登録</Link>
        </p>
        <p className="muted">
          <Link href="/reset">パスワードを忘れた方はこちら</Link>
        </p>
      </section>
    </main>
  );
}
