// Mémoire persistante : les neurones ajoutés (par toi ou par Claude) vivent
// dans un unique fichier JSON d'un store Vercel Blob privé.
import { get, put } from "@vercel/blob";
import { applyPatch, makeNeuron } from "./brain.ts";
import { SEED_NEURONS } from "./seed.ts";
import type { Neuron, NeuronInput, Status } from "./types.ts";
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
    model: MODEL,
  };
}

export class NotPersistentError extends Error {
  constructor() {
    super("La mémoire persistante n'est pas configurée (store Vercel Blob manquant).");
  }
}

export async function readUserNeurons(): Promise<Neuron[]> {
  if (!isPersistent()) return [];
  const res = await get(PATH, { access: "private", useCache: false });
  if (!res || !res.stream) return [];
  const data = JSON.parse(await new Response(res.stream).text());
  return Array.isArray(data) ? (data as Neuron[]) : [];
}

async function writeUserNeurons(list: Neuron[]): Promise<void> {
  if (!isPersistent()) throw new NotPersistentError();
  await put(PATH, JSON.stringify(list), {
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
  return [...SEED_NEURONS.filter((n) => n.type !== "site"), ...live];
}

export async function allNeurons(): Promise<Neuron[]> {
  const [base, user] = await Promise.all([baseNeurons(), readUserNeurons()]);
  return [...base, ...user];
}

export async function addNeuron(input: NeuronInput, source: "user" | "claude"): Promise<Neuron> {
  const n = makeNeuron(input, source);
  const list = await readUserNeurons();
  await writeUserNeurons([...list, n]);
  return n;
}

export async function patchNeuron(id: string, patch: NeuronInput): Promise<Neuron | null> {
  const list = await readUserNeurons();
  const i = list.findIndex((n) => n.id === id);
  if (i < 0) return null;
  list[i] = applyPatch(list[i], patch);
  await writeUserNeurons(list);
  return list[i];
}

export async function removeNeuron(id: string): Promise<boolean> {
  const list = await readUserNeurons();
  const next = list.filter((n) => n.id !== id);
  if (next.length === list.length) return false;
  await writeUserNeurons(next);
  return true;
}
