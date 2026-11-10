// Mémoire persistante : un unique document JSON (neurones ajoutés, annotations
// de la base fixe, projets personnalisés) dans un store Vercel Blob privé.
import { get, put } from "@vercel/blob";
import { applyState, emptyState, makeNeuron, normalizeState, stateAdd, stateAddProject, stateMerge, statePatch, stateRemove, stateRemoveProject } from "./brain.ts";
import { PROJECTS, SEED_NEURONS } from "./seed.ts";
import type { BrainState, Neuron, NeuronInput, Project, ProjectInput, Status } from "./types.ts";
import { liveVercelSites } from "./vercel.ts";

const PATH = "jarvis/neurons.json";

export const MODEL = process.env.JARVIS_MODEL?.trim() || "claude-opus-5-5";

export function isPersistent(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function status(): Status {
  return {
    persistent: isPersistent(),
    chat: Boolean(process.env.ANTHROPIC_API_KEY),
    mcp: Boolean(process.env.JARVIS_MCP_TOKEN),
    vercelLive: Boolean(process.env.VERCEL_TOKEN),
    webSearch: process.env.JARVIS_WEB_SEARCH !== "off",
    model: MODEL,
  };
}

export class NotPersistentError extends Error {
  constructor() {
    super("La mémoire persistante n'est pas configurée (store Vercel Blob manquant).");
  }
}

export async function readState(): Promise<BrainState> {
  if (!isPersistent()) return emptyState();
  const res = await get(PATH, { access: "private", useCache: false });
  if (!res || !res.stream) return emptyState();
  return normalizeState(JSON.parse(await new Response(res.stream).text()));
}

async function writeState(state: BrainState): Promise<void> {
  if (!isPersistent()) throw new NotPersistentError();
  await put(PATH, JSON.stringify(state), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

/** Base fixe (artefacts + sites) : dépôt Git, et Vercel en direct si configuré. */
export async function baseNeurons(): Promise<Neuron[]> {
  const live = await liveVercelSites();
  if (!live) return SEED_NEURONS;
  // Un site connu du dépôt garde son nom et son projet ; les nouveaux s'ajoutent.
  const known = new Map(SEED_NEURONS.filter((n) => n.type === "site").map((n) => [n.id, n]));
  return [...SEED_NEURONS.filter((n) => n.type !== "site"), ...live.map((n) => ({ ...n, ...pick(known.get(n.id)) }))];
}
function pick(n?: Neuron) {
  return n ? { title: n.title, project: n.project } : {};
}

/**
 * Opérations sur la mémoire. Deux mises en œuvre partagent les mêmes règles :
 * `storeOps` écrit dans le stockage, `localOps` travaille sur un état fourni
 * par le navigateur (mode sans stockage) et le rend modifié.
 */
export interface Ops {
  neurons(): Promise<Neuron[]>;
  projects(): Promise<Project[]>;
  add(input: NeuronInput, source: "user" | "claude"): Promise<Neuron>;
  patch(id: string, patch: NeuronInput): Promise<Neuron | null>;
  remove(id: string): Promise<boolean>;
  addProject(input: ProjectInput): Promise<Project>;
  removeProject(id: string): Promise<boolean>;
}

function makeOps(load: () => Promise<BrainState>, save: (s: BrainState) => Promise<void>): Ops {
  const projects = async (s: BrainState) => [...PROJECTS, ...s.projects];
  return {
    neurons: async () => applyState(await baseNeurons(), await load()),
    projects: async () => projects(await load()),
    async add(input, source) {
      const n = makeNeuron(input, source);
      await save(stateAdd(await load(), n));
      return n;
    },
    async patch(id, patch) {
      const r = statePatch(await load(), await baseNeurons(), id, patch);
      if (!r) return null;
      await save(r.state);
      return r.neuron;
    },
    async remove(id) {
      const next = stateRemove(await load(), id);
      if (next) await save(next);
      return Boolean(next);
    },
    async addProject(input) {
      const s = await load();
      const r = stateAddProject(s, input, await projects(s));
      await save(r.state);
      return r.project;
    },
    async removeProject(id) {
      const next = stateRemoveProject(await load(), id);
      if (next) await save(next);
      return Boolean(next);
    },
  };
}

export const storeOps: Ops = makeOps(readState, writeState);

/** Opérations sur un état en mémoire (celui du navigateur) ; `current()` rend l'état modifié. */
export function localOps(initial: unknown): Ops & { current(): BrainState; changed(): boolean } {
  let state = normalizeState(initial);
  let dirty = false;
  const ops = makeOps(
    async () => state,
    async (s) => {
      state = s;
      dirty = true;
    },
  );
  return { ...ops, current: () => state, changed: () => dirty };
}

export async function importState(incoming: unknown): Promise<BrainState> {
  const next = stateMerge(await readState(), normalizeState(incoming), PROJECTS);
  await writeState(next);
  return next;
}
