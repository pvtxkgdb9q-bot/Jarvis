// Serveur MCP minimal (transport « Streamable HTTP », sans état) : c'est le
// lien entre la base de neurones et Claude. Claude.ai / Claude Code s'y
// connectent comme à un connecteur personnalisé.
import { formatNeuron, projectName, searchNeurons, toContext } from "./brain.ts";
import { PROJECTS } from "./seed.ts";
import { addNeuron, allNeurons, NotPersistentError, patchNeuron, removeNeuron } from "./store.ts";
import type { NeuronInput, NeuronType } from "./types.ts";

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

interface RpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

const neuronProps = {
  type: { type: "string", enum: ["note", "task", "idea", "link"], description: "Nature du neurone." },
  title: { type: "string", description: "Titre court et précis." },
  content: { type: "string", description: "Contenu détaillé (facultatif)." },
  url: { type: "string", description: "Lien http(s) associé (facultatif)." },
  project: { type: "string", description: "Identifiant d'un projet existant (voir lister_projets) ou nom libre." },
  tags: { type: "array", items: { type: "string" }, description: "Étiquettes en minuscules." },
};

export const TOOLS = [
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
    name: "memoriser",
    description:
      "Ajoute un neurone durable à la base : note, tâche, idée ou lien. À utiliser quand l'utilisateur demande de retenir quelque chose, ou quand un nouvel artefact / site vient d'être créé (type « link » avec son URL).",
    inputSchema: { type: "object", properties: neuronProps, required: ["title"] },
  },
  {
    name: "modifier",
    description: "Modifie un neurone ajouté précédemment (identifiant obtenu via rechercher). Sert aussi à cocher une tâche (done: true).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" }, ...neuronProps, done: { type: "boolean" } },
      required: ["id"],
    },
  },
  {
    name: "oublier",
    description: "Supprime définitivement un neurone ajouté précédemment. Les artefacts et sites de la base fixe ne peuvent pas être supprimés.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    annotations: { destructiveHint: true },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "rechercher": {
      let list = await allNeurons();
      if (typeof args.type === "string") list = list.filter((n) => n.type === (args.type as NeuronType));
      if (typeof args.projet === "string") list = list.filter((n) => n.project === args.projet);
      const found = searchNeurons(list, String(args.requete ?? ""), PROJECTS);
      const limit = Math.min(50, Math.max(1, Number(args.limite) || 15));
      if (found.length === 0) return "Aucun neurone ne correspond.";
      return [
        `${found.length} résultat(s)${found.length > limit ? `, ${limit} affichés` : ""} :`,
        ...found.slice(0, limit).map((n) => `${formatNeuron(n)}${n.project ? ` · projet: ${projectName(n.project, PROJECTS)}` : ""}`),
      ].join("\n");
    }
    case "lister_projets": {
      const list = await allNeurons();
      return PROJECTS.map((p) => `- ${p.name} (id: ${p.id}) — ${p.summary} · ${list.filter((n) => n.project === p.id).length} neurone(s)`).join("\n");
    }
    case "vue_d_ensemble":
      return toContext(await allNeurons(), PROJECTS);
    case "memoriser": {
      const n = await addNeuron(args as NeuronInput, "claude");
      return `Mémorisé : ${formatNeuron(n)}`;
    }
    case "modifier": {
      const { id, ...patch } = args;
      const n = await patchNeuron(String(id), patch as NeuronInput);
      if (!n) throw new Error("Neurone introuvable ou non modifiable (seuls les neurones ajoutés le sont).");
      return `Modifié : ${formatNeuron(n)}`;
    }
    case "oublier": {
      if (!(await removeNeuron(String(args.id)))) throw new Error("Neurone introuvable ou non supprimable.");
      return "Neurone supprimé.";
    }
    default:
      throw new Error(`Outil inconnu : ${name}`);
  }
}

const ok = (id: RpcRequest["id"], result: unknown) => ({ jsonrpc: "2.0" as const, id, result });
const err = (id: RpcRequest["id"], code: number, message: string) => ({ jsonrpc: "2.0" as const, id: id ?? null, error: { code, message } });

/** Traite un message JSON-RPC. Renvoie null pour une notification (pas de réponse). */
export async function handleRpc(msg: RpcRequest): Promise<object | null> {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return err(null, -32600, "Requête invalide.");
  if (msg.id === undefined) return null;
  switch (msg.method) {
    case "initialize": {
      const asked = String(msg.params?.protocolVersion ?? "");
      return ok(msg.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: "jarvis", title: "Jarvis — base de neurones", version: "1.0.0" },
        instructions:
          "Jarvis est la mémoire personnelle de l'utilisateur : ses artefacts Claude, ses sites Vercel, ses projets, notes, tâches et idées. Consulte-la (rechercher, vue_d_ensemble) avant de répondre à une question sur ses projets, et utilise memoriser quand il te demande de retenir quelque chose.",
      });
    }
    case "ping":
      return ok(msg.id, {});
    case "tools/list":
      return ok(msg.id, { tools: TOOLS });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        return ok(msg.id, { content: [{ type: "text", text: await callTool(name, args) }] });
      } catch (e) {
        const text = e instanceof NotPersistentError
          ? "Écriture impossible : la mémoire persistante (store Vercel Blob) n'est pas configurée sur Jarvis."
          : (e as Error).message;
        return ok(msg.id, { content: [{ type: "text", text }], isError: true });
      }
    }
    default:
      return err(msg.id, -32601, `Méthode inconnue : ${msg.method}`);
  }
}
