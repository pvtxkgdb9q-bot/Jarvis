"use client";
import { useState } from "react";
import { byRecency } from "@/lib/brain";
import { TYPE_LABEL, USER_TYPES, type Neuron, type NeuronType } from "@/lib/types";
import { Empty, Icon, NeuronCard, type UI } from "./ui";
import type { Brain } from "./useBrain";

export function Memory({ brain, ui }: { brain: Brain; ui: UI }) {
  const { neurons, status } = brain;
  const [show, setShow] = useState<"all" | NeuronType>("all");

  // Tâches à faire d'abord (par échéance), puis le reste par date.
  const order = (a: Neuron, b: Neuron) => {
    const ta = a.type === "task" && !a.done, tb = b.type === "task" && !b.done;
    if (ta !== tb) return ta ? -1 : 1;
    if (ta && tb) return (a.due ?? "9").localeCompare(b.due ?? "9") || byRecency(a, b);
    return Number(Boolean(a.done)) - Number(Boolean(b.done)) || byRecency(a, b);
  };
  const mine = neurons.filter((n) => n.source === "user" || n.source === "claude").sort(order);
  const types = USER_TYPES.filter((t) => mine.some((n) => n.type === t) || t === "note" || t === "task");
  const shown = show === "all" ? mine : mine.filter((n) => n.type === show);

  return (
    <div className="view">
      <header className="view-head">
        <h1>Mémoire</h1>
        <p className="lede">
          Ce que tu confies à Jarvis : notes, tâches, idées, liens, nouveaux artefacts et sites. Claude peut aussi y écrire.
          {status && !status.persistent && " Pour l'instant ces neurones sont gardés dans ce navigateur uniquement."}
        </p>
      </header>

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Filtrer la mémoire">
          <button className={show === "all" ? "on" : ""} onClick={() => setShow("all")}>Tout · {mine.length}</button>
          {types.map((t) => (
            <button key={t} className={show === t ? "on" : ""} onClick={() => setShow(t)}>
              {TYPE_LABEL[t]}s · {mine.filter((n) => n.type === t).length}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <button className="btn primary" onClick={() => ui.create({ type: show === "all" ? "note" : show })}><Icon name="plus" size={16} /> Nouveau</button>
      </div>

      {shown.length === 0 ? (
        <Empty title="Rien ici pour l'instant">Ajoute un premier neurone, ou demande à Jarvis de retenir quelque chose.</Empty>
      ) : (
        <div className="grid">{shown.map((n) => <NeuronCard key={n.id} n={n} brain={brain} ui={ui} />)}</div>
      )}
    </div>
  );
}
