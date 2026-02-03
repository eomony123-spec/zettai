"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page">
      <section className="home">
        <h1 className="app-title">天才くん</h1>
        <Link className="btn gold hero-btn" href="/app">
          抽選を始める
        </Link>
      </section>
    </main>
  );
}

