"use client";
import { useEffect, useState } from "react";
import { Icon } from "./ui";
import type { Brain } from "./useBrain";

function Step({ ok, title, children }: { ok: boolean; title: string; children: React.ReactNode }) {
  return (
    <section className={`card step ${ok ? "ok" : ""}`}>
      <header>
        <span className="dot" aria-hidden="true" />
        <h2>{title}</h2>
        <span className="state">{ok ? "Actif" : "À configurer"}</span>
      </header>
      {children}
    </section>
  );
}

export function Connect({ brain }: { brain: Brain }) {
  const { status, neurons } = brain;
  const [mcpUrl, setMcpUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [imported, setImported] = useState(false);

  useEffect(() => {
    fetch("/api/status").then((r) => (r.ok ? r.json() : null)).then((d) => setMcpUrl(d?.mcpUrl ?? null)).catch(() => {});
  }, []);

  async function exportJson() {
    const state = await brain.exportState();
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), state, neurons }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `jarvis-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importJson(file: File | undefined) {
    if (!file) return;
    try {
      if (await brain.importBackup(JSON.parse(await file.text()))) setImported(true);
    } catch {
      alert("Ce fichier n'est pas une sauvegarde Jarvis lisible.");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }

  if (!status) return null;
  return (
    <div className="view narrow">
      <header className="view-head">
        <h1>Lien Claude</h1>
        <p className="lede">Comment Jarvis est relié à ton Claude, et ce qu&apos;il reste à brancher.</p>
      </header>

      <Step ok={status.mcp} title="Connecteur Claude (MCP)">
        <p>
          Donne à Claude l&apos;accès à ta base de neurones : il peut alors y chercher et y écrire depuis n&apos;importe quelle
          conversation, avec ton abonnement Claude (aucune clé API).
        </p>
        {mcpUrl ? (
          <>
            <div className="copy">
              <code>{mcpUrl}</code>
              <button className="btn" onClick={() => navigator.clipboard.writeText(mcpUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>
                <Icon name={copied ? "check" : "copy"} size={16} /> {copied ? "Copié" : "Copier"}
              </button>
            </div>
            <ol>
              <li>Dans Claude : <strong>Paramètres → Connecteurs → Ajouter un connecteur personnalisé</strong>.</li>
              <li>Nom : <code>Jarvis</code>. URL : colle l&apos;adresse ci-dessus.</li>
              <li>Active-le dans une conversation, puis essaie : « Cherche dans Jarvis mes projets SAE », ou « Résume cet artefact et enregistre le résumé dans Jarvis ».</li>
            </ol>
            <p className="muted">Cette adresse contient un jeton secret : ne la partage pas. Pour la révoquer, change <code>JARVIS_MCP_TOKEN</code> sur Vercel.</p>
          </>
        ) : (
          <p className="muted">Définis <code>JARVIS_MCP_TOKEN</code> (une longue chaîne aléatoire) dans les variables d&apos;environnement Vercel, puis redéploie.</p>
        )}
      </Step>

      <Step ok={status.chat} title="Chat intégré">
        <p>L&apos;onglet « Jarvis » appelle Claude ({status.model}) avec toute ta base en contexte. Il peut agir sur la base{status.webSearch ? " et chercher sur le web" : ""}.</p>
        {!status.chat && <p className="muted">Ajoute <code>ANTHROPIC_API_KEY</code> (console.anthropic.com → API Keys) sur Vercel, puis redéploie.</p>}
      </Step>

      <Step ok={status.persistent} title="Mémoire persistante">
        <p>
          {status.persistent
            ? "Tes notes, tâches et idées sont enregistrées dans un store Vercel Blob privé, partagé entre tous tes appareils et Claude."
            : "Tes ajouts sont gardés dans ce navigateur uniquement, et Claude ne peut pas écrire dans la base."}
        </p>
        {!status.persistent && <p className="muted">Sur Vercel : <strong>Storage → Create → Blob (accès privé)</strong>, connecte-le au projet, puis redéploie.</p>}
      </Step>

      <Step ok={status.vercelLive} title="Synchronisation Vercel en direct">
        <p>{status.vercelLive ? "Tes projets Vercel sont listés en temps réel." : "Les sites viennent du fichier data/sites.json du dépôt."}</p>
        {!status.vercelLive && <p className="muted">Facultatif : ajoute <code>VERCEL_TOKEN</code> et <code>VERCEL_TEAM_ID</code> pour que chaque nouveau site apparaisse tout seul.</p>}
      </Step>

      <section className="card step ok">
        <header><h2>Données</h2></header>
        <p>La sauvegarde contient ta mémoire : neurones ajoutés, annotations et projets. La restauration fusionne sans créer de doublon.{imported && " Sauvegarde restaurée."}</p>
        <div className="row">
          <button className="btn" onClick={exportJson}>Exporter une sauvegarde</button>
          <label className="btn">
            Restaurer une sauvegarde
            <input type="file" accept="application/json,.json" hidden onChange={(e) => { void importJson(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <button className="btn ghost" onClick={logout}><Icon name="logout" size={16} /> Se déconnecter</button>
        </div>
      </section>
    </div>
  );
}
