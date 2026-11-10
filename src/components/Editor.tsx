"use client";
import { useEffect, useRef, useState } from "react";
import { KIND_LABEL, TYPE_LABEL, type Kind, type Neuron, type NeuronInput, type NeuronType } from "@/lib/types";
import { Icon } from "./ui";
import type { Brain } from "./useBrain";

const TYPES: NeuronType[] = ["note", "task", "idea", "link", "artifact", "site"];

/**
 * Fenêtre unique de création et de modification. Pour un neurone de la base
 * fixe, seule l'annotation (projet, nature, étiquettes, résumé) est modifiable.
 */
export function Editor({ brain, neuron, defaults, close }: { brain: Brain; neuron?: Neuron; defaults?: NeuronInput; close: () => void }) {
  const fixed = neuron ? neuron.source === "seed" || neuron.source === "vercel" : false;
  const [f, setF] = useState({
    type: (neuron?.type ?? defaults?.type ?? "note") as NeuronType,
    title: neuron?.title ?? defaults?.title ?? "",
    content: neuron?.content ?? defaults?.content ?? "",
    url: neuron?.url ?? defaults?.url ?? "",
    project: neuron?.project ?? defaults?.project ?? "",
    tags: (neuron?.tags ?? defaults?.tags ?? []).join(", "),
    kind: (neuron?.kind ?? "") as Kind | "",
    due: neuron?.due ?? defaults?.due ?? "",
    important: neuron?.important ?? false,
  });
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const linked = f.type === "artifact" || f.type === "site";

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const tags = f.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const input: NeuronInput = fixed
      ? { project: f.project, tags, content: f.content, kind: f.kind || undefined }
      : { type: f.type, title: f.title, content: f.content, url: f.url, project: f.project, tags, kind: f.kind || undefined, due: f.due, important: f.important };
    const ok = neuron ? await brain.patch(neuron.id, input) : await brain.add(input);
    setBusy(false);
    if (ok) close();
  }

  async function remove() {
    if (!neuron) return;
    const msg = fixed ? "Rétablir les valeurs d'origine de cet élément ?" : `Supprimer « ${neuron.title} » ?`;
    if (confirm(msg) && (await brain.remove(neuron.id))) close();
  }

  return (
    <dialog ref={dialog} className="modal" onClose={close} onClick={(e) => e.target === dialog.current && close()}>
      <form className="form" onSubmit={submit}>
        <header className="modal-head">
          <h2>{neuron ? (fixed ? "Annoter" : "Modifier") : "Nouveau neurone"}</h2>
          <button type="button" className="icon-btn" onClick={close} aria-label="Fermer"><Icon name="close" size={16} /></button>
        </header>

        {fixed ? (
          <p className="muted">
            <strong className="plain">{neuron!.title}</strong> fait partie de la base d&apos;origine : son titre et son lien ne changent pas, mais tu peux le
            reclasser et lui donner un résumé, qui servira à la recherche et à Claude.
          </p>
        ) : (
          <div className="row">
            <label>
              Type
              <select value={f.type} disabled={Boolean(neuron)} onChange={(e) => set({ type: e.target.value as NeuronType })}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                ))}
              </select>
            </label>
            <label className="grow">
              Titre
              <input value={f.title} onChange={(e) => set({ title: e.target.value })} required autoFocus={!neuron} />
            </label>
          </div>
        )}

        {!fixed && (linked || f.type === "link" || f.url) && (
          <label>
            Lien {linked && "(obligatoire)"}
            <input type="url" value={f.url} onChange={(e) => set({ url: e.target.value })} placeholder={f.type === "artifact" ? "https://claude.ai/artifact/…" : "https://…"} required={linked} />
          </label>
        )}

        <label>
          {fixed || linked ? "Résumé" : "Détail"}
          <textarea value={f.content} onChange={(e) => set({ content: e.target.value })} rows={fixed ? 5 : 3} placeholder={fixed || linked ? "Ce que contient cet élément, en quelques phrases" : "Facultatif"} />
        </label>

        {f.type === "task" && !fixed && (
          <div className="row">
            <label>
              Échéance
              <input type="date" value={f.due} onChange={(e) => set({ due: e.target.value })} />
            </label>
            <label className="check inline">
              <input type="checkbox" checked={f.important} onChange={(e) => set({ important: e.target.checked })} /> Important
            </label>
          </div>
        )}

        <div className="row">
          <label className="grow">
            Projet
            <select value={brain.projects.some((p) => p.id === f.project) || !f.project ? f.project : "_libre"} onChange={(e) => set({ project: e.target.value === "_libre" ? f.project : e.target.value })}>
              <option value="">Aucun</option>
              {brain.projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              {f.project && !brain.projects.some((p) => p.id === f.project) && <option value="_libre">{f.project}</option>}
            </select>
          </label>
          {(fixed || linked) && (
            <label>
              Nature
              <select value={f.kind} onChange={(e) => set({ kind: e.target.value as Kind | "" })}>
                <option value="">—</option>
                {Object.entries(KIND_LABEL).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </label>
          )}
          <label className="grow">
            Étiquettes
            <input value={f.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="séparées par des virgules" />
          </label>
        </div>

        <div className="row end">
          {neuron && (!fixed || neuron.edited) && (
            <button type="button" className="btn ghost danger" onClick={remove}>
              <Icon name="trash" size={16} /> {fixed ? "Rétablir l'origine" : "Supprimer"}
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={close}>Annuler</button>
          <button className="btn primary" disabled={busy || (!fixed && !f.title.trim())}>{neuron ? "Enregistrer" : "Ajouter"}</button>
        </div>
      </form>
    </dialog>
  );
}
