"use client";
import { useMemo, useState } from "react";
import { agenda, brief, byRecency, isoDay } from "@/lib/brain";
import type { Neuron, NeuronType } from "@/lib/types";
import { Icon, NeuronCard, dueLabel, hueOfProject, type UI } from "./ui";
import type { Brain } from "./useBrain";

function greeting(h: number) {
  return h < 5 ? "Bonne nuit" : h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
}

export function Home({ brain, ui }: { brain: Brain; ui: UI }) {
  const { neurons, projects, favorites, health } = brain;
  const [text, setText] = useState("");
  const [type, setType] = useState<NeuronType>("note");
  const now = new Date();
  const today = isoDay(now);

  const sites = neurons.filter((n) => n.type === "site");
  const checked = sites.filter((n) => health[n.id]);
  const down = checked.filter((n) => health[n.id].state === "down");
  const a = useMemo(() => agenda(neurons, today), [neurons, today]);
  const openTasks = a.late.length + a.today.length + a.week.length + a.later.length + a.undated.length;
  const lines = useMemo(() => brief(neurons, projects, today, down.map((n) => n.title)), [neurons, projects, today, down]);
  const recent = [...neurons].sort(byRecency).slice(0, 6);
  const favs = neurons.filter((n) => favorites.has(n.id));
  const perProject = projects
    .map((p) => ({ p, list: neurons.filter((n) => n.project === p.id) }))
    .filter((x) => x.list.length || x.p.custom)
    .sort((x, y) => y.list.length - x.list.length);

  async function capture(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim() && (await brain.add({ type, title: text }))) setText("");
  }
  async function newProject() {
    const name = prompt("Nom du nouveau projet :");
    if (!name?.trim()) return;
    const p = await brain.addProject({ name, summary: prompt("Description en une phrase (facultatif) :") ?? "" });
    if (p) ui.openProject(p.id);
  }

  const group = (label: string, list: Neuron[], tone = "") =>
    list.length > 0 && (
      <div className={`agenda-group ${tone}`} key={label}>
        <h3>{label} <span className="muted">· {list.length}</span></h3>
        <ul className="tasks">
          {list.slice(0, 6).map((t) => (
            <li key={t.id}>
              <input type="checkbox" checked={false} onChange={() => brain.patch(t.id, { done: true })} aria-label={`Terminer « ${t.title} »`} />
              <button className="task-title" onClick={() => ui.edit(t)}>
                {t.important && <span className="flag">Important</span>} {t.title}
              </button>
              {t.due && <span className={`due ${dueLabel(t.due, today).late ? "late" : ""}`}>{dueLabel(t.due, today).text}</span>}
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <div className="view">
      <header className="hero">
        <p className="eyebrow">{now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1>{greeting(now.getHours())}.</h1>
      </header>

      <section className="card brief" aria-label="Brief du jour">
        <h2>Brief du jour</h2>
        <ul>
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <button className="btn" onClick={() => ui.ask("Fais-moi le brief du jour : ce qui est urgent, ce sur quoi avancer, et ce que j'ai laissé de côté.")}>
          <Icon name="chat" size={16} /> Brief détaillé par Jarvis
        </button>
      </section>

      <form className="capture" onSubmit={capture}>
        <select value={type} onChange={(e) => setType(e.target.value as NeuronType)} aria-label="Type de neurone">
          <option value="note">Note</option>
          <option value="task">Tâche</option>
          <option value="idea">Idée</option>
        </select>
        <input id="capture" value={text} onChange={(e) => setText(e.target.value)} placeholder="Capturer une pensée, une tâche, une idée…" aria-label="Capture rapide" />
        <button className="btn primary" disabled={!text.trim()}>
          <Icon name="plus" size={16} /> Ajouter
        </button>
        <button type="button" className="btn" disabled={!text.trim()} onClick={() => { ui.ask(text); setText(""); }}>
          <Icon name="chat" size={16} /> Demander à Jarvis
        </button>
      </form>

      <section className="stats" aria-label="Chiffres clés">
        <div className="stat"><span className="value">{neurons.filter((n) => n.type === "artifact").length}</span><span className="label">Artefacts Claude</span></div>
        <div className="stat">
          <span className="value">{checked.length ? `${checked.length - down.length}/${sites.length}` : sites.length}</span>
          <span className="label">{checked.length ? (down.length ? "Sites joignables" : "Sites joignables, aucun en panne") : "Sites Vercel"}</span>
        </div>
        <div className="stat"><span className="value">{perProject.length}</span><span className="label">Projets</span></div>
        <div className={`stat ${a.late.length ? "warn" : ""}`}><span className="value">{openTasks}</span><span className="label">Tâches à faire{a.late.length ? `, ${a.late.length} en retard` : ""}</span></div>
      </section>

      {openTasks > 0 && (
        <section>
          <h2>Agenda</h2>
          <div className="agenda">
            {group("En retard", a.late, "late")}
            {group("Aujourd'hui", a.today)}
            {group("Dans les 7 jours", a.week)}
            {group("Plus tard", a.later)}
            {group("Sans date", a.undated)}
          </div>
        </section>
      )}

      {favs.length > 0 && (
        <section>
          <h2>Favoris</h2>
          <div className="grid">{favs.map((n) => <NeuronCard key={n.id} n={n} brain={brain} ui={ui} />)}</div>
        </section>
      )}

      <section>
        <h2>Récemment modifiés</h2>
        <div className="grid">{recent.map((n) => <NeuronCard key={n.id} n={n} brain={brain} ui={ui} />)}</div>
      </section>

      <section>
        <div className="section-head">
          <h2>Projets</h2>
          <button className="btn ghost" onClick={newProject}><Icon name="plus" size={16} /> Nouveau projet</button>
        </div>
        <div className="projects">
          {perProject.map(({ p, list }) => (
            <button key={p.id} className="project" style={{ "--h": hueOfProject(p.id, projects) } as React.CSSProperties} onClick={() => ui.openProject(p.id)}>
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
