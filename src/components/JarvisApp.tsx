"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalize, projectName, searchNeurons } from "@/lib/brain";
import { KIND_LABEL, TYPE_LABEL, type Neuron, type NeuronInput } from "@/lib/types";
import { BrainGraph } from "./BrainGraph";
import { Chat } from "./Chat";
import { Connect } from "./Connect";
import { Editor } from "./Editor";
import { Home } from "./Home";
import { EMPTY_FILTER, Library, type LibraryFilter } from "./Library";
import { Memory } from "./Memory";
import { ProjectView } from "./ProjectView";
import { Icon, type UI } from "./ui";
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

type Theme = "auto" | "light" | "dark";
const THEME_LABEL: Record<Theme, string> = { auto: "Thème : auto", light: "Thème : clair", dark: "Thème : sombre" };

export function JarvisApp() {
  const brain = useBrain();
  const [tab, setTab] = useState<Tab>("home");
  const [project, setProject] = useState<string | null>(null);
  const [filter, setFilter] = useState<LibraryFilter>(EMPTY_FILTER);
  const [pending, setPending] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);
  const [editor, setEditor] = useState<{ neuron?: Neuron; defaults?: NeuronInput } | null>(null);
  const [theme, setTheme] = useState<Theme>("auto");

  const go = useCallback((t: Tab) => {
    setProject(null);
    setTab(t);
    history.replaceState(null, "", `#${t}`);
    window.scrollTo(0, 0);
  }, []);
  const ui = useMemo<UI>(
    () => ({
      edit: (neuron) => setEditor({ neuron }),
      create: (defaults) => setEditor({ defaults }),
      openProject: (id) => {
        setProject(id);
        history.replaceState(null, "", `#project/${encodeURIComponent(id)}`);
        window.scrollTo(0, 0);
      },
      ask: (q) => {
        setPending(q);
        go("chat");
      },
    }),
    [go],
  );

  useEffect(() => {
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash.startsWith("project/")) setProject(hash.slice(8));
    else if (TABS.some((x) => x.id === hash)) setTab(hash as Tab);
    try {
      const t = localStorage.getItem("jarvis.theme") as Theme | null;
      if (t === "light" || t === "dark") setTheme(t);
    } catch { /* thème automatique */ }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      // Raccourcis à une touche : inactifs pendant la saisie ou dans une fenêtre.
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || document.querySelector("dialog[open], .palette")) return;
      if (e.key === "/") { e.preventDefault(); setPalette(true); }
      else if (e.key === "n") { e.preventDefault(); setEditor({}); }
      else if (/^[1-6]$/.test(e.key)) go(TABS[Number(e.key) - 1].id);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [go]);

  function cycleTheme() {
    const next: Theme = theme === "auto" ? "light" : theme === "light" ? "dark" : "auto";
    setTheme(next);
    if (next === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    try {
      if (next === "auto") localStorage.removeItem("jarvis.theme");
      else localStorage.setItem("jarvis.theme", next);
    } catch { /* non mémorisé */ }
  }

  return (
    <div className="app">
      <nav className="nav" aria-label="Navigation principale">
        <div className="brand">
          <span className="orb" aria-hidden="true" />
          <span>JARVIS</span>
        </div>
        {TABS.map((t) => (
          <button key={t.id} className={!project && tab === t.id ? "on" : ""} aria-current={!project && tab === t.id ? "page" : undefined} onClick={() => go(t.id)}>
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </button>
        ))}
        <button className="palette-btn" onClick={() => setPalette(true)}>
          <Icon name="search" />
          <span>Rechercher</span>
          <kbd>⌘K</kbd>
        </button>
        <button className="theme-btn" onClick={cycleTheme} aria-label={`${THEME_LABEL[theme]}. Changer de thème`}>
          <Icon name={theme === "light" ? "sun" : theme === "dark" ? "moon" : "target"} />
          <span>{THEME_LABEL[theme]}</span>
        </button>
      </nav>

      <main>
        {brain.error && (
          <div className="notice error toast" role="alert">
            <span>{brain.error}</span>
            <button className="icon-btn" onClick={brain.clearError} aria-label="Fermer le message"><Icon name="close" size={16} /></button>
          </div>
        )}
        {brain.loading ? (
          <div className="loading" role="status">Chargement de la base de neurones…</div>
        ) : project ? (
          <ProjectView brain={brain} ui={ui} id={project} back={() => go(tab)} />
        ) : (
          <>
            {tab === "home" && <Home brain={brain} ui={ui} />}
            {tab === "library" && <Library brain={brain} ui={ui} filter={filter} setFilter={setFilter} />}
            {tab === "brain" && <BrainGraph brain={brain} ui={ui} />}
            {tab === "chat" && <Chat brain={brain} pending={pending} clearPending={() => setPending(null)} />}
            {tab === "memory" && <Memory brain={brain} ui={ui} />}
            {tab === "connect" && <Connect brain={brain} />}
          </>
        )}
      </main>

      {editor && <Editor key={editor.neuron?.id ?? "new"} brain={brain} neuron={editor.neuron} defaults={editor.defaults} close={() => setEditor(null)} />}

      {palette && (
        <Palette
          brain={brain}
          ui={ui}
          close={() => setPalette(false)}
          go={go}
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

function Palette({ brain, ui, close, go, searchLibrary }: {
  brain: ReturnType<typeof useBrain>;
  ui: UI;
  close: () => void;
  go: (t: Tab) => void;
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
      out.push({ key: "_new", label: "Nouveau neurone", hint: "Touche n", run: () => ui.create() });
      return out;
    }
    const nq = normalize(text);
    for (const p of brain.projects.filter((p) => normalize(p.name).includes(nq)).slice(0, 3)) {
      out.push({ key: `p:${p.id}`, label: p.name, hint: "Projet", run: () => ui.openProject(p.id) });
    }
    for (const n of searchNeurons(brain.neurons, text, brain.projects).slice(0, 8)) {
      out.push({
        key: n.id,
        label: n.title,
        hint: [n.kind ? KIND_LABEL[n.kind] : TYPE_LABEL[n.type], projectName(n.project, brain.projects)].filter(Boolean).join(" · "),
        run: () => (n.url ? window.open(n.url, "_blank", "noopener,noreferrer") : ui.edit(n)),
      });
    }
    out.push({ key: "_lib", label: `Chercher « ${text} » dans la bibliothèque`, hint: "Bibliothèque", run: () => searchLibrary(text) });
    out.push({ key: "_ask", label: `Demander à Jarvis : « ${text} »`, hint: "Chat", run: () => ui.ask(text) });
    out.push({ key: "_note", label: `Créer une note : « ${text} »`, hint: "Mémoire", run: () => void brain.add({ type: "note", title: text }) });
    out.push({ key: "_task", label: `Créer une tâche : « ${text} »`, hint: "Mémoire", run: () => void brain.add({ type: "task", title: text }) });
    return out;
  }, [q, brain, ui, go, searchLibrary]);

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
