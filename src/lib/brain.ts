// Logique pure de la base de neurones : partagée entre le serveur, le
// navigateur et le connecteur MCP. Aucune dépendance, aucun effet de bord.
import type { Neuron, NeuronInput, NeuronType, Project } from "./types.ts";
import { KIND_LABEL, TYPE_LABEL } from "./types.ts";

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function projectName(id: string | undefined, projects: Project[]): string {
  if (!id) return "";
  return projects.find((p) => p.id === id)?.name ?? id;
}

/** Recherche plein texte tolérante aux accents. Tous les mots doivent correspondre. */
export function searchNeurons(neurons: Neuron[], query: string, projects: Project[] = []): Neuron[] {
  const tokens = normalize(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return [...neurons].sort(byRecency);
  const scored: { n: Neuron; score: number }[] = [];
  for (const n of neurons) {
    const title = normalize(n.title);
    const tags = normalize(n.tags.join(" "));
    const proj = normalize(projectName(n.project, projects));
    const kind = normalize(`${TYPE_LABEL[n.type]} ${n.kind ? KIND_LABEL[n.kind] : ""}`);
    const content = normalize(n.content ?? "");
    let score = 0;
    let all = true;
    for (const t of tokens) {
      let s = 0;
      if (hasWord(title, t)) s += 4;
      if (hasWord(tags, t)) s += 3;
      if (hasWord(proj, t)) s += 2;
      if (hasWord(kind, t)) s += 1;
      if (hasWord(content, t)) s += 1;
      if (s === 0) {
        all = false;
        break;
      }
      score += s;
    }
    if (all) scored.push({ n, score });
  }
  return scored.sort((a, b) => b.score - a.score || byRecency(a.n, b.n)).map((x) => x.n);
}

/** Vrai si un mot du texte commence par le jeton (recherche par préfixe). */
function hasWord(text: string, token: string): boolean {
  return text.startsWith(token) || text.includes(" " + token);
}

export function byRecency(a: Neuron, b: Neuron): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

export function slug(s: string): string {
  return normalize(s).replace(/ /g, "-").slice(0, 48);
}

const TYPES: NeuronType[] = ["note", "task", "idea", "link"];

/** Valide et nettoie une entrée utilisateur / Claude avant création. */
export function makeNeuron(input: NeuronInput, source: "user" | "claude", now = new Date()): Neuron {
  const title = String(input.title ?? "").trim().slice(0, 200);
  if (!title) throw new Error("Le titre est obligatoire.");
  const type = TYPES.includes(input.type as NeuronType) ? (input.type as NeuronType) : "note";
  const url = cleanUrl(input.url);
  const iso = now.toISOString();
  const n: Neuron = {
    id: `${type}-${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    type,
    title,
    tags: cleanTags(input.tags),
    createdAt: iso,
    updatedAt: iso,
    source,
  };
  const content = String(input.content ?? "").trim().slice(0, 8000);
  if (content) n.content = content;
  if (url) n.url = url;
  const project = String(input.project ?? "").trim().slice(0, 80);
  if (project) n.project = project;
  if (type === "task") n.done = Boolean(input.done);
  return n;
}

export function applyPatch(n: Neuron, patch: NeuronInput, now = new Date()): Neuron {
  const out: Neuron = { ...n, updatedAt: now.toISOString() };
  if (patch.title !== undefined) {
    const t = String(patch.title).trim().slice(0, 200);
    if (t) out.title = t;
  }
  if (patch.content !== undefined) out.content = String(patch.content).trim().slice(0, 8000) || undefined;
  if (patch.url !== undefined) out.url = cleanUrl(patch.url);
  if (patch.project !== undefined) out.project = String(patch.project).trim().slice(0, 80) || undefined;
  if (patch.tags !== undefined) out.tags = cleanTags(patch.tags);
  if (patch.done !== undefined && out.type === "task") out.done = Boolean(patch.done);
  return out;
}

function cleanTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  for (const t of tags) {
    const v = String(t).trim().toLowerCase().slice(0, 40);
    if (v) seen.add(v);
  }
  return [...seen].slice(0, 12);
}

/** N'accepte que des liens http(s) — jamais de javascript: ou data:. */
function cleanUrl(u: unknown): string | undefined {
  if (typeof u !== "string" || !u.trim()) return undefined;
  try {
    const parsed = new URL(u.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

// --- Graphe ---------------------------------------------------------------

export interface GraphNode {
  id: string;
  label: string;
  kind: "core" | "project" | "neuron";
  hue: number;
  size: number;
  neuron?: Neuron;
  projectId?: string;
}
export interface GraphLink {
  source: string;
  target: string;
  strength: number;
}

/**
 * Construit le graphe : noyau → projets → neurones, plus des synapses légères
 * entre neurones de projets différents qui partagent une étiquette.
 */
export function buildGraph(neurons: Neuron[], projects: Project[]): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes: GraphNode[] = [{ id: "core", label: "JARVIS", kind: "core", hue: 190, size: 20 }];
  const links: GraphLink[] = [];
  const known = new Map(projects.map((p) => [p.id, p]));
  const used = new Map<string, { name: string; hue: number; count: number }>();
  for (const n of neurons) {
    const key = n.project || "_libre";
    const p = known.get(key);
    const cur = used.get(key);
    if (cur) cur.count++;
    else used.set(key, { name: p?.name ?? (n.project || "Sans projet"), hue: p?.hue ?? hueOf(key), count: 1 });
  }
  for (const [id, p] of used) {
    nodes.push({ id: `p:${id}`, label: p.name, kind: "project", hue: p.hue, size: 9 + Math.min(8, p.count), projectId: id });
    links.push({ source: "core", target: `p:${id}`, strength: 0.5 });
  }
  for (const n of neurons) {
    const key = n.project || "_libre";
    nodes.push({ id: n.id, label: n.title, kind: "neuron", hue: used.get(key)!.hue, size: n.type === "artifact" || n.type === "site" ? 5 : 4, neuron: n, projectId: key });
    links.push({ source: `p:${key}`, target: n.id, strength: 1 });
  }
  const byTag = new Map<string, Neuron[]>();
  for (const n of neurons) for (const t of n.tags) (byTag.get(t) ?? byTag.set(t, []).get(t)!).push(n);
  const seen = new Set<string>();
  for (const [tag, list] of byTag) {
    if (list.length < 2 || list.length > 5 || tag === "site") continue;
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if ((a.project || "") === (b.project || "")) continue;
        const k = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
        if (seen.has(k)) continue;
        seen.add(k);
        links.push({ source: a.id, target: b.id, strength: 0.08 });
      }
  }
  return { nodes, links };
}

function hueOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

// --- Contexte pour Claude ---------------------------------------------------

/** Index compact de toute la base, injecté dans le prompt système de Jarvis. */
export function toContext(neurons: Neuron[], projects: Project[]): string {
  const groups = new Map<string, Neuron[]>();
  for (const n of [...neurons].sort(byRecency)) {
    const k = n.project || "";
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(n);
  }
  const out: string[] = [];
  for (const [pid, list] of groups) {
    const p = projects.find((x) => x.id === pid);
    out.push(`## ${p ? p.name : pid || "Sans projet"}${p ? ` — ${p.summary}` : ""}`);
    for (const n of list) out.push(formatNeuron(n));
    out.push("");
  }
  return out.join("\n").trim();
}

export function formatNeuron(n: Neuron): string {
  const kind = n.kind ? KIND_LABEL[n.kind] : TYPE_LABEL[n.type];
  const bits = [`- [${kind}] ${n.title}`];
  if (n.type === "task") bits.push(n.done ? "(fait)" : "(à faire)");
  bits.push(`· maj ${n.updatedAt.slice(0, 10)}`);
  if (n.tags.length) bits.push(`· #${n.tags.join(" #")}`);
  if (n.url) bits.push(`· ${n.url}`);
  bits.push(`· id:${n.id}`);
  let line = bits.join(" ");
  if (n.content) line += `\n  ${n.content.replace(/\s+/g, " ").slice(0, 600)}`;
  return line;
}
