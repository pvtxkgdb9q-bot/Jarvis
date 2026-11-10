"use client";
import { useMemo, useState } from "react";
import { byRecency } from "@/lib/brain";
import type { NeuronType } from "@/lib/types";
import { Icon, NeuronCard, hueOfProject } from "./ui";
import type { Brain } from "./useBrain";

function greeting(h: number) {
  return h < 5 ? "Bonne nuit" : h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
}

export function Home({ brain, onOpenProject, onAsk }: { brain: Brain; onOpenProject: (id: string) => void; onAsk: (q: string) => void }) {
  const { neurons, projects, favorites } = brain;
  const [text, setText] = useState("");
  const [type, setType] = useState<NeuronType>("note");
  const now = new Date();

  const stats = useMemo(
    () => ({
      artifacts: neurons.filter((n) => n.type === "artifact").length,
      sites: neurons.filter((n) => n.type === "site").length,
      projects: new Set(neurons.map((n) => n.project).filter(Boolean)).size,
      memory: neurons.filter((n) => n.source === "user" || n.source === "claude").length,
    }),
    [neurons],
  );
  const tasks = neurons.filter((n) => n.type === "task" && !n.done).sort(byRecency);
  const recent = [...neurons].sort(byRecency).slice(0, 6);
  const favs = neurons.filter((n) => favorites.has(n.id));
  const perProject = projects
    .map((p) => ({ p, list: neurons.filter((n) => n.project === p.id) }))
    .filter((x) => x.list.length)
    .sort((a, b) => b.list.length - a.list.length);

  async function capture(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    if (await brain.add({ type, title: text })) setText("");
  }

  return (
    <div className="view">
      <header className="hero">
        <p className="eyebrow">{now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1>{greeting(now.getHours())}.</h1>
        <p className="lede">
          {stats.artifacts} artefacts, {stats.sites} site{stats.sites > 1 ? "s" : ""} et {stats.memory} souvenir{stats.memory > 1 ? "s" : ""} reliés en {stats.projects} projets.
        </p>
      </header>

      <form className="capture" onSubmit={capture}>
        <select value={type} onChange={(e) => setType(e.target.value as NeuronType)} aria-label="Type de neurone">
          <option value="note">Note</option>
          <option value="task">Tâche</option>
          <option value="idea">Idée</option>
        </select>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Capturer une pensée, une tâche, une idée…" aria-label="Capture rapide" />
        <button className="btn primary" disabled={!text.trim()}>
          <Icon name="plus" size={16} /> Ajouter
        </button>
        <button type="button" className="btn" disabled={!text.trim()} onClick={() => { onAsk(text); setText(""); }}>
          <Icon name="chat" size={16} /> Demander à Jarvis
        </button>
      </form>

      <section className="stats" aria-label="Chiffres clés">
        {[
          ["Artefacts Claude", stats.artifacts],
          ["Sites Vercel", stats.sites],
          ["Projets", stats.projects],
          ["Tâches à faire", tasks.length],
        ].map(([label, value]) => (
          <div className="stat" key={label}>
            <span className="value">{value}</span>
            <span className="label">{label}</span>
          </div>
        ))}
      </section>

      {tasks.length > 0 && (
        <section>
          <h2>À faire</h2>
          <ul className="tasks">
            {tasks.slice(0, 6).map((t) => (
              <li key={t.id}>
                <label>
                  <input type="checkbox" checked={false} onChange={() => brain.patch(t.id, { done: true })} />
                  <span>{t.title}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {favs.length > 0 && (
        <section>
          <h2>Favoris</h2>
          <div className="grid">
            {favs.map((n) => (
              <NeuronCard key={n.id} n={n} projects={projects} favorite onFavorite={() => brain.toggleFavorite(n.id)} onProject={onOpenProject} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2>Récemment modifiés</h2>
        <div className="grid">
          {recent.map((n) => (
            <NeuronCard key={n.id} n={n} projects={projects} favorite={favorites.has(n.id)} onFavorite={() => brain.toggleFavorite(n.id)} onProject={onOpenProject} />
          ))}
        </div>
      </section>

      <section>
        <h2>Projets</h2>
        <div className="projects">
          {perProject.map(({ p, list }) => (
            <button key={p.id} className="project" style={{ "--h": hueOfProject(p.id, projects) } as React.CSSProperties} onClick={() => onOpenProject(p.id)}>
              <span className="count">{list.length}</span>
              <strong>{p.name}</strong>
              <span>{p.summary}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
