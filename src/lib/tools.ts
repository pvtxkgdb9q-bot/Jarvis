// Outils d'action sur la base, partagés par le connecteur MCP et le chat :
// une seule définition, une seule exécution.
import { agenda, formatNeuron, isoDay, projectName, searchNeurons, toContext } from "./brain.ts";
import type { Ops } from "./store.ts";
import type { NeuronInput, NeuronType } from "./types.ts";

const neuronProps = {
  title: { type: "string", description: "Titre court et précis." },
  content: { type: "string", description: "Contenu ou résumé (facultatif)." },
  url: { type: "string", description: "Lien http(s). Obligatoire pour un artefact ou un site." },
  project: { type: "string", description: "Identifiant d'un projet existant (voir lister_projets) ou nom libre." },
  tags: { type: "array", items: { type: "string" }, description: "Étiquettes en minuscules." },
  kind: { type: "string", enum: ["app", "site", "doc", "cdc", "fiche", "guide", "3d", "planning"], description: "Nature d'un artefact ou d'un site." },
  due: { type: "string", description: "Échéance d'une tâche, au format AAAA-MM-JJ. Chaîne vide pour la retirer." },
  important: { type: "boolean", description: "Tâche importante." },
};

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  annotations?: Record<string, boolean>;
}

export const TOOLS: ToolDef[] = [
  {
    name: "rechercher",
    description:
      "Recherche dans la base de neurones de l'utilisateur : ses artefacts Claude, ses sites Vercel, ses notes, tâches, idées et liens. À appeler dès qu'une question porte sur ses projets, ses documents ou ce qu'il a demandé de retenir. Requête vide = éléments les plus récents.",
    inputSchema: {
      type: "object",
      properties: {
        requete: { type: "string", description: "Mots-clés (accents ignorés)." },
        type: { type: "string", enum: ["artifact", "site", "note", "task", "idea", "link"] },
        projet: { type: "string", description: "Identifiant de projet pour filtrer." },
        limite: { type: "number", description: "Nombre maximal de résultats (défaut 15)." },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "lister_projets",
    description: "Liste les projets de l'utilisateur avec leur résumé et le nombre de neurones rattachés.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: "vue_d_ensemble",
    description: "Renvoie l'index complet de la base de neurones, groupé par projet. Utile en début de conversation pour connaître tout le contexte de l'utilisateur.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: "taches",
    description: "Liste les tâches ouvertes de l'utilisateur, classées : en retard, aujourd'hui, dans les 7 jours, plus tard, sans date.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: "memoriser",
    description:
      "Ajoute un neurone durable à la base : note, tâche (avec échéance éventuelle), idée, lien, ou un nouvel artefact Claude / site (type « artifact » ou « site », avec son URL). À utiliser quand l'utilisateur demande de retenir quelque chose, ou quand un artefact ou un site vient d'être créé.",
    inputSchema: {
      type: "object",
      properties: { type: { type: "string", enum: ["note", "task", "idea", "link", "artifact", "site"], description: "Nature du neurone (défaut : note)." }, ...neuronProps },
      required: ["title"],
    },
  },
  {
    name: "modifier",
    description:
      "Modifie un neurone (identifiant obtenu via rechercher). Sur un neurone ajouté : tous les champs, y compris done (cocher une tâche) et due. Sur un artefact ou un site de la base fixe : enregistre une annotation — project, kind, tags, et content (un résumé du contenu, qui rend l'élément trouvable sur le fond).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" }, ...neuronProps, done: { type: "boolean", description: "Tâche terminée." } },
      required: ["id"],
    },
  },
  {
    name: "oublier",
    description: "Supprime définitivement un neurone ajouté. Sur un neurone de la base fixe, retire seulement son annotation.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    annotations: { destructiveHint: true },
  },
  {
    name: "creer_projet",
    description: "Crée un nouveau projet pour y rattacher des neurones.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, summary: { type: "string", description: "Description en une phrase." } }, required: ["name"] },
  },
];

/** Exécute un outil et renvoie son résultat en texte. Lève une erreur lisible en cas d'échec. */
export async function runTool(ops: Ops, name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "rechercher": {
      const [all, projects] = await Promise.all([ops.neurons(), ops.projects()]);
      let list = all;
      if (typeof args.type === "string") list = list.filter((n) => n.type === (args.type as NeuronType));
      if (typeof args.projet === "string") list = list.filter((n) => n.project === args.projet);
      const found = searchNeurons(list, String(args.requete ?? ""), projects);
      const limit = Math.min(50, Math.max(1, Number(args.limite) || 15));
      if (found.length === 0) return "Aucun neurone ne correspond.";
      return [
        `${found.length} résultat(s)${found.length > limit ? `, ${limit} affichés` : ""} :`,
        ...found.slice(0, limit).map((n) => `${formatNeuron(n)}${n.project ? ` · projet: ${projectName(n.project, projects)}` : ""}`),
      ].join("\n");
    }
    case "lister_projets": {
      const [list, projects] = await Promise.all([ops.neurons(), ops.projects()]);
      return projects.map((p) => `- ${p.name} (id: ${p.id}) — ${p.summary || "sans description"} · ${list.filter((n) => n.project === p.id).length} neurone(s)`).join("\n");
    }
    case "vue_d_ensemble":
      return toContext(await ops.neurons(), await ops.projects());
    case "taches": {
      const a = agenda(await ops.neurons(), isoDay(new Date()));
      const part = (label: string, list: typeof a.late) => (list.length ? [`${label} :`, ...list.map(formatNeuron)] : []);
      const out = [...part("En retard", a.late), ...part("Aujourd'hui", a.today), ...part("Dans les 7 jours", a.week), ...part("Plus tard", a.later), ...part("Sans date", a.undated)];
      return out.length ? out.join("\n") : "Aucune tâche ouverte.";
    }
    case "memoriser":
      return `Mémorisé : ${formatNeuron(await ops.add(args as NeuronInput, "claude"))}`;
    case "modifier": {
      const { id, ...patch } = args;
      const n = await ops.patch(String(id), patch as NeuronInput);
      if (!n) throw new Error("Neurone introuvable : vérifie l'identifiant avec rechercher.");
      return `Modifié : ${formatNeuron(n)}`;
    }
    case "oublier":
      if (!(await ops.remove(String(args.id)))) throw new Error("Rien à supprimer : neurone introuvable, ou neurone de la base fixe sans annotation.");
      return "Supprimé.";
    case "creer_projet": {
      const p = await ops.addProject({ name: String(args.name ?? ""), summary: typeof args.summary === "string" ? args.summary : "" });
      return `Projet créé : ${p.name} (id: ${p.id}).`;
    }
    default:
      throw new Error(`Outil inconnu : ${name}`);
  }
}
