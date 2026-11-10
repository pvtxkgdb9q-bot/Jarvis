"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { projectName, searchNeurons } from "@/lib/brain";
import { KIND_LABEL, TYPE_LABEL } from "@/lib/types";
import { BrainGraph } from "./BrainGraph";
import { Chat } from "./Chat";
import { Connect } from "./Connect";
import { Home } from "./Home";
import { EMPTY_FILTER, Library, type LibraryFilter } from "./Library";
import { Memory } from "./Memory";
import { Icon } from "./ui";
import { useBrain } from "./useBrain";

type Tab = "home" | "library" | "brain" | "chat" | "memory" | "connect";
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "Accueil", icon: "home" },
  { id: "library", label: "Bibliothèque", icon: "library" },
  { id: "brain", label: "Cerveau", icon: "brain" },
  { id: "chat", label: "Jarvis", icon: "chat" },
  { id: "memory", label: "Mémoire", icon: "memory" },
  { id: "connect", label: "Lien Claude", icon: "link" },
];

export function JarvisApp() {
  const brain = useBrain();
  const [tab, setTab] = useState<Tab>("home");
  const [filter, setFilter] = useState<LibraryFilter>(EMPTY_FILTER);
  const [pending, setPending] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    const t = location.hash.slice(1) as Tab;
    if (TABS.some((x) => x.id === t)) setTab(t);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const go = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
    window.scrollTo(0, 0);
  };
  const openProject = (id: string) => {
    setFilter({ ...EMPTY_FILTER, project: id });
    go("library");
  };
  const ask = (q: string) => {
    setPending(q);
    go("chat");
  };

  return (
    <div className="app">
      <nav className="nav" aria-label="Navigation principale">
        <div className="brand">
          <span className="orb" aria-hidden="true" />
          <span>JARVIS</span>
        </div>
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "on" : ""} aria-current={tab === t.id ? "page" : undefined} onClick={() => go(t.id)}>
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </button>
        ))}
        <button className="palette-btn" onClick={() => setPalette(true)}>
          <Icon name="search" />
          <span>Rechercher</span>
          <kbd>⌘K</kbd>
        </button>
      </nav>

      <main>
        {brain.error && <div className="notice error" role="alert">{brain.error}</div>}
        {brain.loading ? (
          <div className="loading" role="status">Chargement de la base de neurones…</div>
        ) : (
          <>
            {tab === "home" && <Home brain={brain} onOpenProject={openProject} onAsk={ask} />}
            {tab === "library" && <Library brain={brain} filter={filter} setFilter={setFilter} />}
            {tab === "brain" && <BrainGraph brain={brain} onOpenProject={openProject} />}
            {tab === "chat" && <Chat brain={brain} pending={pending} clearPending={() => setPending(null)} />}
            {tab === "memory" && <Memory brain={brain} />}
            {tab === "connect" && <Connect brain={brain} />}
          </>
        )}
      </main>

      {palette && (
        <Palette
          brain={brain}
          close={() => setPalette(false)}
          go={go}
          ask={ask}
          searchLibrary={(q) => { setFilter({ ...EMPTY_FILTER, q }); go("library"); }}
        />
      )}
    </div>
  );
}

interface Item {
  key: string;
  label: string;
  hint: string;
  run: () => void;
}

function Palette({ brain, close, go, ask, searchLibrary }: {
  brain: ReturnType<typeof useBrain>;
  close: () => void;
  go: (t: Tab) => void;
  ask: (q: string) => void;
  searchLibrary: (q: string) => void;
}) {
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const text = q.trim();
    if (!text) {
      for (const t of TABS) out.push({ key: t.id, label: t.label, hint: "Aller à", run: () => go(t.id) });
      return out;
    }
    for (const n of searchNeurons(brain.neurons, text, brain.projects).slice(0, 8)) {
      out.push({
        key: n.id,
        label: n.title,
        hint: [n.kind ? KIND_LABEL[n.kind] : TYPE_LABEL[n.type], projectName(n.project, brain.projects)].filter(Boolean).join(" · "),
        run: () => (n.url ? window.open(n.url, "_blank", "noopener,noreferrer") : searchLibrary(n.title)),
      });
    }
    out.push({ key: "_lib", label: `Chercher « ${text} » dans la bibliothèque`, hint: "Bibliothèque", run: () => searchLibrary(text) });
    out.push({ key: "_ask", label: `Demander à Jarvis : « ${text} »`, hint: "Chat", run: () => ask(text) });
    out.push({ key: "_note", label: `Créer une note : « ${text} »`, hint: "Mémoire", run: () => void brain.add({ type: "note", title: text }) });
    out.push({ key: "_task", label: `Créer une tâche : « ${text} »`, hint: "Mémoire", run: () => void brain.add({ type: "task", title: text }) });
    return out;
  }, [q, brain, go, ask, searchLibrary]);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => setIndex(0), [q]);
  useEffect(() => list.current?.children[index]?.scrollIntoView({ block: "nearest" }), [index]);

  const run = (i: Item) => {
    i.run();
    close();
  };
  return (
    <div className="palette-backdrop" onClick={close}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Recherche et commandes"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
          else if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(items.length - 1, i + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
          else if (e.key === "Enter" && items[index]) { e.preventDefault(); run(items[index]); }
        }}
      >
        <label className="search">
          <Icon name="search" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un neurone, poser une question, créer une note…" aria-label="Recherche" />
        </label>
        <ul ref={list} role="listbox">
          {items.map((it, i) => (
            <li key={it.key} role="option" aria-selected={i === index} className={i === index ? "on" : ""} onMouseEnter={() => setIndex(i)} onClick={() => run(it)}>
              <span>{it.label}</span>
              <small>{it.hint}</small>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
