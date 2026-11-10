"use client";
import { byRecency, projectName } from "@/lib/brain";
import type { Neuron } from "@/lib/types";
import { Empty, Icon, NeuronCard, hueOfProject, type UI } from "./ui";
import type { Brain } from "./useBrain";

/** Page d'un projet : tout ce qui s'y rattache, regroupé par usage. */
export function ProjectView({ brain, ui, id, back }: { brain: Brain; ui: UI; id: string; back: () => void }) {
  const { neurons, projects } = brain;
  const p = projects.find((x) => x.id === id);
  const name = projectName(id, projects);
  const list = neurons.filter((n) => n.project === id).sort(byRecency);
  const apps = list.filter((n) => n.type === "site" || n.kind === "app" || n.kind === "site" || n.kind === "3d");
  const docs = list.filter((n) => n.type === "artifact" && !apps.includes(n));
  const tasks = list.filter((n) => n.type === "task").sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? "9").localeCompare(b.due ?? "9"));
  const notes = list.filter((n) => n.type === "note" || n.type === "idea" || n.type === "link");

  async function remove() {
    if (confirm(`Supprimer le projet « ${name} » ? Ses neurones sont conservés.`) && (await brain.removeProject(id))) back();
  }
  const section = (title: string, items: Neuron[]) =>
    items.length > 0 && (
      <section>
        <h2>{title} <span className="muted">· {items.length}</span></h2>
        <div className="grid">{items.map((n) => <NeuronCard key={n.id} n={n} brain={brain} ui={ui} />)}</div>
      </section>
    );

  return (
    <div className="view" style={{ "--h": hueOfProject(id, projects) } as React.CSSProperties}>
      <header className="view-head">
        <button className="btn ghost back" onClick={back}>← Retour</button>
        <p className="eyebrow project-eyebrow">Projet</p>
        <h1>{name}</h1>
        {p?.summary && <p className="lede">{p.summary}</p>}
        <div className="toolbar">
          <button className="btn primary" onClick={() => ui.ask(`Fais-moi un point complet sur le projet « ${name} » : ce qui existe, ce qui reste à faire, et la prochaine étape logique.`)}>
            <Icon name="chat" size={16} /> En parler à Jarvis
          </button>
          <button className="btn" onClick={() => ui.create({ type: "task", project: id })}><Icon name="plus" size={16} /> Tâche</button>
          <button className="btn" onClick={() => ui.create({ type: "note", project: id })}><Icon name="plus" size={16} /> Note</button>
          <button className="btn" onClick={() => ui.create({ type: "artifact", project: id })}><Icon name="plus" size={16} /> Artefact</button>
          <span className="spacer" />
          {p?.custom && <button className="btn ghost danger" onClick={remove}><Icon name="trash" size={16} /> Supprimer le projet</button>}
        </div>
      </header>
      {list.length === 0 && <Empty title="Projet vide">Ajoute une tâche, une note ou un artefact pour commencer.</Empty>}
      {section("Tâches", tasks)}
      {section("Applications, sites et modèles", apps)}
      {section("Documents", docs)}
      {section("Notes, idées et liens", notes)}
    </div>
  );
}
