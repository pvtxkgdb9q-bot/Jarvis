"use client";
import { useState } from "react";
import { byRecency } from "@/lib/brain";
import { TYPE_LABEL, USER_TYPES, type Neuron, type NeuronType } from "@/lib/types";
import { Empty, Icon, NeuronCard } from "./ui";
import type { Brain } from "./useBrain";

const BLANK = { type: "note" as NeuronType, title: "", content: "", url: "", project: "", tags: "" };

export function Memory({ brain }: { brain: Brain }) {
  const { neurons, projects, favorites, status } = brain;
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState<string | null>(null);
  const [show, setShow] = useState<"all" | NeuronType>("all");
  const [busy, setBusy] = useState(false);

  const mine = neurons.filter((n) => n.source === "user" || n.source === "claude").sort(byRecency);
  const shown = show === "all" ? mine : mine.filter((n) => n.type === show);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setBusy(true);
    const input = { ...form, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) };
    if (editing) await brain.patch(editing, input);
    else await brain.add(input);
    setBusy(false);
    setForm({ ...BLANK, type: form.type });
    setEditing(null);
  }

  function edit(n: Neuron) {
    setEditing(n.id);
    setForm({ type: n.type, title: n.title, content: n.content ?? "", url: n.url ?? "", project: n.project ?? "", tags: n.tags.join(", ") });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="view">
      <header className="view-head">
        <h1>Mémoire</h1>
        <p className="lede">
          Ce que tu confies à Jarvis : notes, tâches, idées, liens. Claude peut aussi y écrire via le connecteur.
          {status && !status.persistent && " Pour l'instant ces neurones sont gardés dans ce navigateur uniquement."}
        </p>
      </header>

      <form className="card form" onSubmit={submit}>
        <div className="row">
          <label>
            Type
            <select value={form.type} disabled={Boolean(editing)} onChange={(e) => setForm({ ...form, type: e.target.value as NeuronType })}>
              {USER_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABEL[t]}</option>
              ))}
            </select>
          </label>
          <label className="grow">
            Titre
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Réviser la RDM avant le partiel" required />
          </label>
        </div>
        <label>
          Détail
          <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={3} placeholder="Facultatif" />
        </label>
        <div className="row">
          <label className="grow">
            Lien
            <input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" />
          </label>
          <label>
            Projet
            <input list="projects" value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} placeholder="Identifiant ou nom libre" />
            <datalist id="projects">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </datalist>
          </label>
          <label>
            Étiquettes
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="séparées par des virgules" />
          </label>
        </div>
        <div className="row end">
          {editing && <button type="button" className="btn ghost" onClick={() => { setEditing(null); setForm(BLANK); }}>Annuler</button>}
          <button className="btn primary" disabled={busy || !form.title.trim()}>{editing ? "Enregistrer" : "Ajouter à la mémoire"}</button>
        </div>
      </form>

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Filtrer la mémoire">
          <button className={show === "all" ? "on" : ""} onClick={() => setShow("all")}>Tout · {mine.length}</button>
          {USER_TYPES.map((t) => (
            <button key={t} className={show === t ? "on" : ""} onClick={() => setShow(t)}>
              {TYPE_LABEL[t]}s · {mine.filter((n) => n.type === t).length}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <Empty title="Rien ici pour l'instant">Ajoute une première note ci-dessus, ou demande à Jarvis de retenir quelque chose.</Empty>
      ) : (
        <div className="grid">
          {shown.map((n) => (
            <NeuronCard
              key={n.id}
              n={n}
              projects={projects}
              favorite={favorites.has(n.id)}
              onFavorite={() => brain.toggleFavorite(n.id)}
              actions={
                <>
                  {n.type === "task" && (
                    <button className={`icon-btn ${n.done ? "on" : ""}`} onClick={() => brain.patch(n.id, { done: !n.done })} aria-label={n.done ? "Marquer à faire" : "Marquer comme fait"}>
                      <Icon name="check" size={16} />
                    </button>
                  )}
                  <button className="icon-btn" onClick={() => edit(n)} aria-label={`Modifier ${n.title}`}><Icon name="edit" size={16} /></button>
                  <button className="icon-btn danger" onClick={() => confirm(`Supprimer « ${n.title} » ?`) && brain.remove(n.id)} aria-label={`Supprimer ${n.title}`}><Icon name="trash" size={16} /></button>
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
