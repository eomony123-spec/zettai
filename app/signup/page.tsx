"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { isSupabaseReady, supabase } from "../../lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) {
      setError("認証設定が未完了です。しばらく待ってから再読み込みしてください。");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password
    });
    if (signUpError) {
      setError("登録に失敗しました。別のメールアドレスをお試しください。");
      setLoading(false);
      return;
    }

    if (data.user && !data.session) {
      setNotice("確認メールを送信しました。メール内のリンクから有効化してください。");
    } else {
      setNotice("登録できました。ログイン画面へ移動します。");
      router.push("/login");
    }
    setLoading(false);
  };

  return (
    <main className="page">
      <section className="card narrow">
        <h1 className="title">新規登録</h1>
        {!isSupabaseReady ? (
          <p className="error">認証設定が未完了です。</p>
        ) : null}
        <form className="form" onSubmit={handleSignup}>
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
          {notice ? <p className="notice">{notice}</p> : null}
          <button className="btn gold" type="submit" disabled={loading || !isSupabaseReady}>
            {loading ? "登録中..." : "登録"}
          </button>
        </form>
        <p className="muted">
          既にアカウントがある方は <Link href="/login">ログイン</Link>
        </p>
      </section>
    </main>
  );
}
