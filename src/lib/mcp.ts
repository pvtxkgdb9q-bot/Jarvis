// Serveur MCP minimal (transport « Streamable HTTP », sans état) : c'est le
// lien entre la base de neurones et Claude. Claude.ai / Claude Code s'y
// connectent comme à un connecteur personnalisé.
import { NotPersistentError, storeOps, type Ops } from "./store.ts";
import { runTool, TOOLS } from "./tools.ts";

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

interface RpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

const ok = (id: RpcRequest["id"], result: unknown) => ({ jsonrpc: "2.0" as const, id, result });
const err = (id: RpcRequest["id"], code: number, message: string) => ({ jsonrpc: "2.0" as const, id: id ?? null, error: { code, message } });

/** Traite un message JSON-RPC. Renvoie null pour une notification (pas de réponse). */
export async function handleRpc(msg: RpcRequest, ops: Ops = storeOps): Promise<object | null> {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return err(null, -32600, "Requête invalide.");
  if (msg.id === undefined) return null;
  switch (msg.method) {
    case "initialize": {
      const asked = String(msg.params?.protocolVersion ?? "");
      return ok(msg.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: "jarvis", title: "Jarvis — base de neurones", version: "2.0.0" },
        instructions:
          "Jarvis est la mémoire personnelle de l'utilisateur : ses artefacts Claude, ses sites Vercel, ses projets, notes, tâches et idées. Consulte-la (rechercher, vue_d_ensemble, taches) avant de répondre à une question sur ses projets ou son organisation. Utilise memoriser quand il te demande de retenir quelque chose ou quand tu viens de créer pour lui un artefact ou un site, et modifier pour cocher une tâche, corriger un classement ou enregistrer le résumé d'un artefact.",
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
        return ok(msg.id, { content: [{ type: "text", text: await runTool(ops, name, args) }] });
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

/** Traite le corps d'une requête HTTP MCP (message seul ou lot). */
export async function handleBody(body: unknown): Promise<Response> {
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleRpc(m)))).filter(Boolean);
    return out.length ? Response.json(out) : new Response(null, { status: 202 });
  }
  const res = await handleRpc(body as RpcRequest);
  return res ? Response.json(res) : new Response(null, { status: 202 });
}

export async function validToken(token: string | null | undefined): Promise<boolean> {
  const { safeEqual } = await import("./auth.ts");
  const expected = process.env.JARVIS_MCP_TOKEN?.trim();
  return Boolean(token) && Boolean(expected) && expected!.length >= 16 && (await safeEqual(token!, expected!));
}

export async function serve(req: Request, token: string | null | undefined): Promise<Response> {
  if (!(await validToken(token))) return Response.json({ error: "Non autorisé." }, { status: 401 });
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON invalide." } }, { status: 400 });
  }
  return handleBody(body);
}
