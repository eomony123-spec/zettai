import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="page">
      <section className="card narrow">
        <h1>ログイン</h1>
        <p className="muted">このMVPではログインは不要です。</p>
        <form className="form">
          <label>
            Email
            <input type="email" placeholder="you@example.com" />
          </label>
          <label>
            Password
            <input type="password" placeholder="********" />
          </label>
          <button className="btn primary" type="button">
            Log in (stub)
          </button>
        </form>
        <div className="split">
          <Link href="/app">抽選ツールへ</Link>
          <button className="link" type="button">
            Reset password
          </button>
        </div>
      </section>
    </main>
  );
}
