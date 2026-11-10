"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { applyPatch, makeNeuron } from "@/lib/brain";
import type { Neuron, NeuronInput, Project, Status } from "@/lib/types";

const LOCAL_KEY = "jarvis.neurons.v1";
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
  neurons: Neuron[];
  projects: Project[];
  status: Status | null;
  favorites: Set<string>;
  toggleFavorite: (id: string) => void;
  add: (input: NeuronInput) => Promise<Neuron | null>;
  /** Intègre un neurone créé par Jarvis pendant le chat. */
  adopt: (n: Neuron, persisted: boolean) => void;
  patch: (id: string, patch: NeuronInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
  localNeurons: Neuron[];
  reload: () => void;
}

/**
 * État de la base côté navigateur. Si le serveur a un stockage persistant,
 * les écritures passent par l'API ; sinon elles restent dans localStorage.
 */
export function useBrain(): Brain {
  const [server, setServer] = useState<Neuron[]>([]);
  const [local, setLocal] = useState<Neuron[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLocal(load<Neuron[]>(LOCAL_KEY, []));
    setFavorites(new Set(load<string[]>(FAV_KEY, [])));
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
        setProjects(data.projects);
        setStatus(data.status);
        setError(null);
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tick]);

  const persistent = status?.persistent ?? false;
  const updateLocal = useCallback((fn: (l: Neuron[]) => Neuron[]) => {
    setLocal((l) => {
      const next = fn(l);
      save(LOCAL_KEY, next);
      return next;
    });
  }, []);

  const add = useCallback(
    async (input: NeuronInput) => {
      try {
        if (persistent) {
          const r = await fetch("/api/neurons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
          const data = await r.json();
          if (!r.ok) throw new Error(data.error);
          setServer((s) => [...s, data.neuron]);
          return data.neuron as Neuron;
        }
        const n = makeNeuron(input, "user");
        updateLocal((l) => [...l, n]);
        return n;
      } catch (e) {
        setError((e as Error).message);
        return null;
      }
    },
    [persistent, updateLocal],
  );

  const adopt = useCallback(
    (n: Neuron, persisted: boolean) => {
      if (persisted) setServer((s) => (s.some((x) => x.id === n.id) ? s : [...s, n]));
      else updateLocal((l) => (l.some((x) => x.id === n.id) ? l : [...l, n]));
    },
    [updateLocal],
  );

  const patch = useCallback(
    async (id: string, p: NeuronInput) => {
      if (local.some((n) => n.id === id)) {
        updateLocal((l) => l.map((n) => (n.id === id ? applyPatch(n, p) : n)));
        return;
      }
      const prev = server;
      setServer((s) => s.map((n) => (n.id === id ? applyPatch(n, p) : n)));
      const r = await fetch(`/api/neurons/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
      if (!r.ok) {
        setServer(prev);
        setError("La modification n'a pas pu être enregistrée.");
      }
    },
    [local, server, updateLocal],
  );

  const remove = useCallback(
    async (id: string) => {
      if (local.some((n) => n.id === id)) {
        updateLocal((l) => l.filter((n) => n.id !== id));
        return;
      }
      const prev = server;
      setServer((s) => s.filter((n) => n.id !== id));
      const r = await fetch(`/api/neurons/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!r.ok) {
        setServer(prev);
        setError("La suppression n'a pas pu être enregistrée.");
      }
    },
    [local, server, updateLocal],
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

  const neurons = useMemo(() => [...server, ...local], [server, local]);
  return { loading, error, neurons, projects, status, favorites, toggleFavorite, add, adopt, patch, remove, localNeurons: local, reload: () => setTick((t) => t + 1) };
}
