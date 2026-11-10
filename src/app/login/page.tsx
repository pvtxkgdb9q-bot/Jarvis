"use client";
import { useState } from "react";

export default function Login() {
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    if (res.ok) location.href = "/";
    else {
      setError((await res.json().catch(() => null))?.error ?? "Connexion impossible.");
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="card" onSubmit={submit}>
        <span className="orb big" aria-hidden="true" />
        <h1>JARVIS</h1>
        <p className="lede">Accès réservé.</p>
        <label>
          Mot de passe
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus autoComplete="current-password" required />
        </label>
        {error && <p className="notice error" role="alert">{error}</p>}
        <button className="btn primary" disabled={busy || !pw}>{busy ? "Vérification…" : "Entrer"}</button>
      </form>
    </main>
  );
}
