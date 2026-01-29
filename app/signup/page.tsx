import Link from "next/link";

export default function SignupPage() {
  return (
    <main className="page">
      <section className="card narrow">
        <h1>新規登録</h1>
        <p className="muted">このMVPでは登録は不要です。</p>
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
            Sign up (stub)
          </button>
        </form>
        <div className="split">
          <Link href="/app">抽選ツールへ</Link>
        </div>
      </section>
    </main>
  );
}
