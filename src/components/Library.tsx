"use client";
import { useMemo } from "react";
import { projectName, searchNeurons } from "@/lib/brain";
import { KIND_LABEL, type Kind, type Neuron } from "@/lib/types";
import { Empty, Icon, NeuronCard } from "./ui";
import type { Brain } from "./useBrain";

export interface LibraryFilter {
  q: string;
  type: "all" | "artifact" | "site" | "memory" | "favorites";
  kind: "" | Kind;
  project: string;
  group: boolean;
}
export const EMPTY_FILTER: LibraryFilter = { q: "", type: "all", kind: "", project: "", group: false };

const TYPES: [LibraryFilter["type"], string][] = [
  ["all", "Tout"],
  ["artifact", "Artefacts"],
  ["site", "Sites"],
  ["memory", "Mémoire"],
  ["favorites", "Favoris"],
];

export function Library({ brain, filter, setFilter }: { brain: Brain; filter: LibraryFilter; setFilter: (f: LibraryFilter) => void }) {
  const { neurons, projects, favorites } = brain;
  const set = (p: Partial<LibraryFilter>) => setFilter({ ...filter, ...p });

  const results = useMemo(() => {
    let list = neurons;
    if (filter.type === "artifact" || filter.type === "site") list = list.filter((n) => n.type === filter.type);
    if (filter.type === "memory") list = list.filter((n) => n.source === "user" || n.source === "claude");
    if (filter.type === "favorites") list = list.filter((n) => favorites.has(n.id));
    if (filter.kind) list = list.filter((n) => n.kind === filter.kind);
    if (filter.project) list = list.filter((n) => n.project === filter.project);
    return searchNeurons(list, filter.q, projects);
  }, [neurons, projects, favorites, filter]);

  const usedProjects = useMemo(() => [...new Set(neurons.map((n) => n.project).filter(Boolean) as string[])], [neurons]);
  const groups = useMemo(() => {
    const m = new Map<string, Neuron[]>();
    for (const n of results) (m.get(n.project ?? "") ?? m.set(n.project ?? "", []).get(n.project ?? "")!).push(n);
    return [...m].sort((a, b) => b[1].length - a[1].length);
  }, [results]);
  const active = filter.q || filter.type !== "all" || filter.kind || filter.project;

  const card = (n: Neuron) => (
    <NeuronCard key={n.id} n={n} projects={projects} favorite={favorites.has(n.id)} onFavorite={() => brain.toggleFavorite(n.id)} onProject={(id) => set({ project: id })} />
  );

  return (
    <div className="view">
      <header className="view-head">
        <h1>Bibliothèque</h1>
        <p className="lede">Tous tes artefacts Claude, tes sites Vercel et ta mémoire, au même endroit.</p>
      </header>

      <div className="toolbar">
        <label className="search">
          <Icon name="search" size={16} />
          <input value={filter.q} onChange={(e) => set({ q: e.target.value })} placeholder="Rechercher un titre, une étiquette, un projet…" aria-label="Rechercher dans la bibliothèque" />
        </label>
        <select value={filter.project} onChange={(e) => set({ project: e.target.value })} aria-label="Projet">
          <option value="">Tous les projets</option>
          {usedProjects.map((id) => (
            <option key={id} value={id}>{projectName(id, projects)}</option>
          ))}
        </select>
        <select value={filter.kind} onChange={(e) => set({ kind: e.target.value as LibraryFilter["kind"] })} aria-label="Nature">
          <option value="">Toutes les natures</option>
          {Object.entries(KIND_LABEL).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </div>

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Type">
          {TYPES.map(([id, label]) => (
            <button key={id} className={filter.type === id ? "on" : ""} aria-pressed={filter.type === id} onClick={() => set({ type: id })}>{label}</button>
          ))}
        </div>
        <span className="spacer" />
        <span className="count-label">{results.length} résultat{results.length > 1 ? "s" : ""}</span>
        <label className="check">
          <input type="checkbox" checked={filter.group} onChange={(e) => set({ group: e.target.checked })} /> Grouper par projet
        </label>
        {active && <button className="btn ghost" onClick={() => setFilter({ ...EMPTY_FILTER, group: filter.group })}>Réinitialiser</button>}
      </div>

      {results.length === 0 ? (
        <Empty title="Aucun résultat">Essaie d&apos;autres mots-clés ou retire un filtre.</Empty>
      ) : filter.group ? (
        groups.map(([pid, list]) => (
          <section key={pid}>
            <h2>{projectName(pid, projects) || "Sans projet"} <span className="muted">· {list.length}</span></h2>
            <div className="grid">{list.map(card)}</div>
          </section>
        ))
      ) : (
        <div className="grid">{results.map(card)}</div>
      )}
    </div>
  );
}
