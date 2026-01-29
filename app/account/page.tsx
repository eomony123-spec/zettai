export default function AccountPage() {
  return (
    <main className="page">
      <section className="card">
        <h1>アカウント</h1>
        <p className="muted">このMVPではアカウント機能はありません。</p>
        <div className="account-row">
          <div>
            <div className="label">Status</div>
            <div className="status">n/a</div>
          </div>
          <button className="btn primary" type="button">
            Open portal (stub)
          </button>
        </div>
      </section>
    </main>
  );
}
