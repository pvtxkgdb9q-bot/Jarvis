// Logique pure de la base de neurones : partagée entre le serveur, le
// navigateur et le connecteur MCP. Aucune dépendance, aucun effet de bord.
import type { BrainState, Kind, Neuron, NeuronInput, NeuronType, Override, Project, ProjectInput } from "./types.ts";
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

const TYPES: NeuronType[] = ["note", "task", "idea", "link", "artifact", "site"];
const KINDS: Kind[] = ["app", "site", "doc", "cdc", "fiche", "guide", "3d", "planning"];

/** Valide et nettoie une entrée utilisateur / Claude avant création. */
export function makeNeuron(input: NeuronInput, source: "user" | "claude", now = new Date()): Neuron {
  const title = String(input.title ?? "").trim().slice(0, 200);
  if (!title) throw new Error("Le titre est obligatoire.");
  const url = cleanUrl(input.url);
  let type = TYPES.includes(input.type as NeuronType) ? (input.type as NeuronType) : "note";
  // Un lien d'artefact Claude est reconnu, quel que soit le type annoncé.
  if (url && /^https:\/\/claude\.ai\/(code\/)?artifact\//.test(url) && (type === "link" || type === "note")) type = "artifact";
  if ((type === "artifact" || type === "site") && !url) throw new Error("Un artefact ou un site doit avoir un lien http(s).");
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
  const kind = cleanKind(input.kind) ?? (type === "site" ? "site" : undefined);
  if (kind && (type === "artifact" || type === "site")) n.kind = kind;
  if (type === "task") {
    n.done = Boolean(input.done);
    const due = cleanDue(input.due);
    if (due) n.due = due;
    if (input.important) n.important = true;
  }
  return n;
}

export function applyPatch(n: Neuron, patch: NeuronInput, now = new Date()): Neuron {
  const out: Neuron = { ...n, updatedAt: now.toISOString() };
  if (patch.title !== undefined) {
    const t = String(patch.title).trim().slice(0, 200);
    if (t) out.title = t;
  }
  if (patch.content !== undefined) out.content = String(patch.content).trim().slice(0, 8000) || undefined;
  if (patch.url !== undefined) {
    const u = cleanUrl(patch.url);
    // Un artefact ou un site ne peut pas perdre son lien.
    if (u || (out.type !== "artifact" && out.type !== "site")) out.url = u;
  }
  if (patch.project !== undefined) out.project = String(patch.project).trim().slice(0, 80) || undefined;
  if (patch.tags !== undefined) out.tags = cleanTags(patch.tags);
  if (patch.kind !== undefined && (out.type === "artifact" || out.type === "site")) out.kind = cleanKind(patch.kind);
  if (out.type === "task") {
    if (patch.done !== undefined) out.done = Boolean(patch.done);
    if (patch.due !== undefined) out.due = cleanDue(patch.due);
    if (patch.important !== undefined) out.important = Boolean(patch.important) || undefined;
  }
  return out;
}

function cleanKind(k: unknown): Kind | undefined {
  return KINDS.includes(k as Kind) ? (k as Kind) : undefined;
}

/** Une échéance est une date réelle au format AAAA-MM-JJ, sinon elle est refusée. */
function cleanDue(d: unknown): string | undefined {
  if (d === undefined || d === null || d === "") return undefined;
  const s = String(d).trim();
  const t = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null;
  if (!t || Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== s) throw new Error("Échéance invalide : utilise le format AAAA-MM-JJ.");
  return s;
}

function cleanTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  for (const t of tags) {
    const v = String(t).trim().toLowerCase().replace(/^#/, "").slice(0, 40);
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

// --- Mémoire : état, annotations, projets ---------------------------------

export function emptyState(): BrainState {
  return { version: 2, neurons: [], overrides: {}, projects: [] };
}

/** Lit un état stocké, y compris l'ancien format (simple liste de neurones). */
export function normalizeState(raw: unknown): BrainState {
  if (Array.isArray(raw)) return { ...emptyState(), neurons: raw.filter(isNeuron) };
  const r = (raw ?? {}) as Partial<BrainState>;
  return {
    version: 2,
    neurons: Array.isArray(r.neurons) ? r.neurons.filter(isNeuron) : [],
    overrides: r.overrides && typeof r.overrides === "object" && !Array.isArray(r.overrides) ? r.overrides : {},
    projects: Array.isArray(r.projects) ? r.projects.filter((p) => p && typeof p.id === "string" && typeof p.name === "string") : [],
  };
}

function isNeuron(n: unknown): n is Neuron {
  const x = n as Neuron;
  return Boolean(x) && typeof x.id === "string" && typeof x.title === "string" && Array.isArray(x.tags);
}

export function isEmptyState(s: BrainState): boolean {
  return s.neurons.length === 0 && s.projects.length === 0 && Object.keys(s.overrides).length === 0;
}

/** Base fixe + annotations + neurones ajoutés = ce que voient l'interface et Claude. */
export function applyState(base: Neuron[], state: BrainState): Neuron[] {
  const baseIds = new Set(base.map((n) => n.id));
  return [
    ...base.map((n) => {
      const o = state.overrides[n.id];
      return o ? { ...n, ...o, edited: true } : n;
    }),
    ...state.neurons.filter((n) => !baseIds.has(n.id)),
  ];
}

export function stateAdd(state: BrainState, n: Neuron): BrainState {
  return { ...state, neurons: [...state.neurons, n] };
}

/**
 * Modifie un neurone. Ajouté par l'utilisateur : modification complète.
 * Issu de la base fixe : seule une annotation (projet, nature, étiquettes,
 * résumé) est enregistrée — jamais le titre ni le lien.
 */
export function statePatch(state: BrainState, base: Neuron[], id: string, patch: NeuronInput): { state: BrainState; neuron: Neuron } | null {
  const i = state.neurons.findIndex((n) => n.id === id);
  if (i >= 0) {
    const neurons = [...state.neurons];
    neurons[i] = applyPatch(neurons[i], patch);
    return { state: { ...state, neurons }, neuron: neurons[i] };
  }
  const original = base.find((n) => n.id === id);
  if (!original) return null;
  const o: Override = { ...state.overrides[id] };
  if (patch.project !== undefined) o.project = String(patch.project).trim().slice(0, 80) || undefined;
  if (patch.tags !== undefined) o.tags = cleanTags(patch.tags);
  if (patch.content !== undefined) o.content = String(patch.content).trim().slice(0, 8000) || undefined;
  if (patch.kind !== undefined) o.kind = cleanKind(patch.kind);
  for (const k of Object.keys(o) as (keyof Override)[]) if (o[k] === undefined) delete o[k];
  const next = { ...state, overrides: { ...state.overrides, [id]: o } };
  return { state: next, neuron: { ...original, ...o, edited: true } };
}

/** Supprime un neurone ajouté, ou retire l'annotation d'un neurone de la base fixe. */
export function stateRemove(state: BrainState, id: string): BrainState | null {
  if (state.neurons.some((n) => n.id === id)) return { ...state, neurons: state.neurons.filter((n) => n.id !== id) };
  if (state.overrides[id]) {
    const overrides = { ...state.overrides };
    delete overrides[id];
    return { ...state, overrides };
  }
  return null;
}

export function stateAddProject(state: BrainState, input: ProjectInput, existing: Project[]): { state: BrainState; project: Project } {
  const name = String(input.name ?? "").trim().slice(0, 60);
  if (!name) throw new Error("Le nom du projet est obligatoire.");
  const id = slug(name);
  if (!id) throw new Error("Nom de projet invalide.");
  if (existing.some((p) => p.id === id || normalize(p.name) === normalize(name))) throw new Error(`Le projet « ${name} » existe déjà.`);
  // Couleur : la teinte la plus éloignée de celles déjà utilisées.
  const hues = existing.map((p) => p.hue);
  let hue = 0, best = -1;
  for (let h = 0; h < 360; h += 15) {
    const d = Math.min(360, ...hues.map((x) => Math.min(Math.abs(x - h), 360 - Math.abs(x - h))));
    if (d > best) { best = d; hue = h; }
  }
  const project: Project = { id, name, hue, summary: String(input.summary ?? "").trim().slice(0, 300), custom: true };
  return { state: { ...state, projects: [...state.projects, project] }, project };
}

export function stateRemoveProject(state: BrainState, id: string): BrainState | null {
  if (!state.projects.some((p) => p.id === id)) return null;
  return { ...state, projects: state.projects.filter((p) => p.id !== id) };
}

/** Fusionne une sauvegarde dans l'état courant, sans doublon (l'existant gagne). */
export function stateMerge(current: BrainState, incoming: BrainState, baseProjects: Project[] = []): BrainState {
  const ids = new Set(current.neurons.map((n) => n.id));
  const pids = new Set([...baseProjects, ...current.projects].map((p) => p.id));
  return {
    version: 2,
    neurons: [...current.neurons, ...incoming.neurons.filter((n) => !ids.has(n.id))],
    overrides: { ...incoming.overrides, ...current.overrides },
    projects: [...current.projects, ...incoming.projects.filter((p) => !pids.has(p.id)).map((p) => ({ ...p, custom: true }))],
  };
}

// --- Agenda et brief ------------------------------------------------------

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface Agenda {
  late: Neuron[];
  today: Neuron[];
  week: Neuron[];
  later: Neuron[];
  undated: Neuron[];
}

/** Répartit les tâches ouvertes par échéance ; les importantes passent en tête. */
export function agenda(neurons: Neuron[], today: string): Agenda {
  const a: Agenda = { late: [], today: [], week: [], later: [], undated: [] };
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + 7);
  const weekEnd = limit.toISOString().slice(0, 10);
  for (const n of neurons) {
    if (n.type !== "task" || n.done) continue;
    if (!n.due) a.undated.push(n);
    else if (n.due < today) a.late.push(n);
    else if (n.due === today) a.today.push(n);
    else if (n.due <= weekEnd) a.week.push(n);
    else a.later.push(n);
  }
  const order = (x: Neuron, y: Neuron) =>
    Number(Boolean(y.important)) - Number(Boolean(x.important)) || (x.due ?? "9").localeCompare(y.due ?? "9") || byRecency(x, y);
  for (const k of Object.keys(a) as (keyof Agenda)[]) a[k].sort(order);
  return a;
}

/** Brief du jour, calculé sans appel à Claude. */
export function brief(neurons: Neuron[], projects: Project[], today: string, sitesDown: string[] = []): string[] {
  const a = agenda(neurons, today);
  const lines: string[] = [];
  const plural = (n: number, s: string) => `${n} ${s}${n > 1 ? "s" : ""}`;
  if (a.late.length) lines.push(`${plural(a.late.length, "tâche")} en retard, dont « ${a.late[0].title} ».`);
  if (a.today.length) lines.push(`${plural(a.today.length, "tâche")} pour aujourd'hui : ${a.today.map((t) => `« ${t.title} »`).slice(0, 3).join(", ")}.`);
  if (!a.late.length && !a.today.length) lines.push(a.week.length ? `Rien d'urgent aujourd'hui ; ${plural(a.week.length, "tâche")} dans les 7 jours.` : "Aucune tâche urgente.");
  if (sitesDown.length) lines.push(`Site${sitesDown.length > 1 ? "s" : ""} hors ligne : ${sitesDown.join(", ")}.`);
  const latest = [...neurons].sort(byRecency)[0];
  if (latest) lines.push(`Dernière activité : « ${latest.title} »${latest.project ? ` (${projectName(latest.project, projects)})` : ""}.`);
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const quiet = projects.filter((p) => {
    const list = neurons.filter((n) => n.project === p.id);
    return list.length > 0 && list.every((n) => n.updatedAt < cutoff.toISOString());
  });
  if (quiet.length) lines.push(`Sans activité depuis plus de 30 jours : ${quiet.map((p) => p.name).slice(0, 4).join(", ")}.`);
  return lines;
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
  if (n.type === "task") bits.push(n.done ? "(fait)" : `(à faire${n.due ? `, échéance ${n.due}` : ""}${n.important ? ", important" : ""})`);
  bits.push(`· maj ${n.updatedAt.slice(0, 10)}`);
  if (n.tags.length) bits.push(`· #${n.tags.join(" #")}`);
  if (n.url) bits.push(`· ${n.url}`);
  bits.push(`· id:${n.id}`);
  let line = bits.join(" ");
  if (n.content) line += `\n  ${n.content.replace(/\s+/g, " ").slice(0, 600)}`;
  return line;
}
