"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyState, emptyState, isEmptyState, makeNeuron, normalizeState, stateAdd, stateAddProject, stateMerge, statePatch, stateRemove, stateRemoveProject } from "@/lib/brain";
import type { BrainState, Neuron, NeuronInput, Project, ProjectInput, SiteHealth, Status } from "@/lib/types";

const STATE_KEY = "jarvis.state.v2";
const OLD_KEY = "jarvis.neurons.v1";
const FAV_KEY = "jarvis.favorites.v1";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible (navigation privée) : on continue en mémoire */
  }
}

export interface Brain {
  loading: boolean;
  error: string | null;
  clearError: () => void;
  neurons: Neuron[];
  projects: Project[];
  status: Status | null;
  health: Record<string, SiteHealth>;
  favorites: Set<string>;
  toggleFavorite: (id: string) => void;
  /** Chaque écriture renvoie vrai si elle a réussi ; sinon `error` est renseigné. */
  add: (input: NeuronInput) => Promise<boolean>;
  patch: (id: string, patch: NeuronInput) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  addProject: (input: ProjectInput) => Promise<Project | null>;
  removeProject: (id: string) => Promise<boolean>;
  importBackup: (raw: unknown) => Promise<boolean>;
  exportState: () => Promise<BrainState>;
  /** Mémoire locale, envoyée au chat quand le serveur n'a pas de stockage. */
  localState: BrainState;
  setLocalState: (s: unknown) => void;
  reload: () => void;
}

async function call(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? `Erreur ${r.status}`);
  return data;
}

/**
 * État de la base côté navigateur. Si le serveur a un stockage persistant,
 * les écritures passent par l'API ; sinon elles restent dans localStorage,
 * avec exactement les mêmes règles (fonctions pures de lib/brain).
 */
export function useBrain(): Brain {
  const [server, setServer] = useState<Neuron[]>([]);
  const [serverProjects, setServerProjects] = useState<Project[]>([]);
  const [local, setLocal] = useState<BrainState>(emptyState());
  const [status, setStatus] = useState<Status | null>(null);
  const [health, setHealth] = useState<Record<string, SiteHealth>>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const migrated = useRef(false);

  useEffect(() => {
    // Reprend l'ancien format (liste de neurones) s'il existe encore.
    const old = load<unknown>(OLD_KEY, null);
    const state = normalizeState(load<unknown>(STATE_KEY, old ?? null));
    setLocal(state);
    if (old) {
      save(STATE_KEY, state);
      try { localStorage.removeItem(OLD_KEY); } catch { /* sans importance */ }
    }
    setFavorites(new Set(load<string[]>(FAV_KEY, [])));
    fetch("/api/health").then((r) => (r.ok ? r.json() : null)).then((d) => d && setHealth(d.sites)).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/neurons")
      .then(async (r) => {
        if (r.status === 401) {
          location.href = "/login";
          return;
        }
        const data = await r.json();
        if (!alive) return;
        if (!r.ok) throw new Error(data.error ?? "Erreur de chargement");
        setServer(data.neurons);
        setServerProjects(data.projects);
        setStatus(data.status);
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tick]);

  const persistent = status?.persistent ?? false;
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const writeLocal = useCallback((next: BrainState) => {
    setLocal(next);
    save(STATE_KEY, next);
  }, []);

  // Dès que le stockage serveur existe, la mémoire du navigateur y est versée.
  useEffect(() => {
    if (!persistent || migrated.current || isEmptyState(local)) return;
    migrated.current = true;
    call("/api/import", "POST", { state: local })
      .then(() => {
        writeLocal(emptyState());
        reload();
      })
      .catch((e: Error) => setError(`Reprise de la mémoire locale impossible : ${e.message}`));
  }, [persistent, local, writeLocal, reload]);

  const projects = useMemo(() => [...serverProjects, ...local.projects.filter((p) => !serverProjects.some((s) => s.id === p.id))], [serverProjects, local.projects]);
  const neurons = useMemo(() => applyState(server, local), [server, local]);

  /** Exécute une écriture ; toute erreur (validation, réseau) devient un message. */
  const attempt = useCallback(async (fn: () => Promise<void> | void): Promise<boolean> => {
    try {
      await fn();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }, []);

  const add = useCallback(
    (input: NeuronInput) =>
      attempt(async () => {
        if (!persistent) return writeLocal(stateAdd(local, makeNeuron(input, "user")));
        const { neuron } = await call("/api/neurons", "POST", input);
        setServer((s) => [...s, neuron]);
      }),
    [attempt, persistent, local, writeLocal],
  );

  const patch = useCallback(
    (id: string, p: NeuronInput) =>
      attempt(async () => {
        if (!persistent) {
          const r = statePatch(local, server, id, p);
          if (!r) throw new Error("Neurone introuvable.");
          return writeLocal(r.state);
        }
        const { neuron } = await call(`/api/neurons/${encodeURIComponent(id)}`, "PATCH", p);
        setServer((s) => s.map((n) => (n.id === id ? neuron : n)));
      }),
    [attempt, persistent, local, server, writeLocal],
  );

  const remove = useCallback(
    (id: string) =>
      attempt(async () => {
        if (!persistent) {
          const next = stateRemove(local, id);
          if (!next) throw new Error("Rien à supprimer.");
          return writeLocal(next);
        }
        await call(`/api/neurons/${encodeURIComponent(id)}`, "DELETE");
        reload(); // retirer une annotation fait réapparaître les valeurs d'origine
      }),
    [attempt, persistent, local, writeLocal, reload],
  );

  const addProject = useCallback(
    async (input: ProjectInput) => {
      let project: Project | null = null;
      await attempt(async () => {
        if (!persistent) {
          const r = stateAddProject(local, input, projects);
          writeLocal(r.state);
          project = r.project;
          return;
        }
        project = (await call("/api/projects", "POST", input)).project as Project;
        setServerProjects((s) => [...s, project!]);
      });
      return project;
    },
    [attempt, persistent, local, projects, writeLocal],
  );

  const removeProject = useCallback(
    (id: string) =>
      attempt(async () => {
        if (!persistent) {
          const next = stateRemoveProject(local, id);
          if (!next) throw new Error("Projet introuvable.");
          return writeLocal(next);
        }
        await call(`/api/projects/${encodeURIComponent(id)}`, "DELETE");
        setServerProjects((s) => s.filter((p) => p.id !== id));
      }),
    [attempt, persistent, local, writeLocal],
  );

  const importBackup = useCallback(
    (raw: unknown) =>
      attempt(async () => {
        const r = raw as { state?: unknown; neurons?: unknown };
        const incoming = normalizeState(r?.state ?? r);
        if (isEmptyState(incoming)) throw new Error("Ce fichier ne contient aucune mémoire Jarvis.");
        if (!persistent) return writeLocal(stateMerge(local, incoming, serverProjects));
        await call("/api/import", "POST", { state: incoming });
        reload();
      }),
    [attempt, persistent, local, serverProjects, writeLocal, reload],
  );

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((f) => {
      const next = new Set(f);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      save(FAV_KEY, [...next]);
      return next;
    });
  }, []);

  return {
    loading, error, clearError: () => setError(null), neurons, projects, status, health, favorites, toggleFavorite,
    add, patch, remove, addProject, removeProject, importBackup,
    exportState: async () => (persistent ? normalizeState((await call("/api/neurons", "GET")).state) : local),
    localState: local,
    setLocalState: (s) => writeLocal(normalizeState(s)),
    reload,
  };
}
