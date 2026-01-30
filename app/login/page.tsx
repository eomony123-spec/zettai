"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "../../lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (signInError) {
      setError("ログインに失敗しました。メールとパスワードを確認してください。");
      setLoading(false);
      return;
    }
    router.push("/app");
  };

  return (
    <main className="page">
      <section className="card narrow">
        <h1 className="title">ログイン</h1>
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
          <button className="btn gold" type="submit" disabled={loading}>
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>
        <p className="muted">
          アカウントがない方は <Link href="/signup">新規登録</Link>
        </p>
      </section>
    </main>
  );
}
