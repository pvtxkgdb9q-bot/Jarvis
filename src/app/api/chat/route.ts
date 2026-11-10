import Anthropic from "@anthropic-ai/sdk";
import { agenda, formatNeuron, isoDay, toContext } from "@/lib/brain";
import { isPersistent, localOps, MODEL, status, storeOps, type Ops } from "@/lib/store";
import { runTool, TOOLS } from "@/lib/tools";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SYSTEM = `Tu es Jarvis, l'assistant personnel de l'utilisateur. Tu parles français, tu le tutoies, et tu vas droit au but : réponses courtes par défaut, détaillées quand la question le demande.

Tu disposes de sa « base de neurones » ci-dessous : ses artefacts Claude, ses sites Vercel, ses projets, et les notes, tâches, idées et liens qu'il t'a confiés. C'est ta mémoire de lui. Appuie-toi dessus pour répondre, relie les éléments entre eux quand c'est utile (par exemple un cahier des charges et l'application qui en découle), et donne le lien d'un élément quand tu le cites — en Markdown, [titre](url).

Les artefacts ne sont connus que par leur titre, leur projet, leurs étiquettes et, quand il existe, un résumé. Si une question porte sur un contenu que tu n'as pas, dis-le simplement et propose d'ouvrir l'élément.

Tu peux agir sur la base :
- memoriser : quand il te demande de retenir, noter ou planifier quelque chose (note, tâche avec échéance, idée, lien, nouvel artefact ou site).
- modifier : pour cocher une tâche, déplacer une échéance, corriger un titre, reclasser un élément ou enregistrer le résumé d'un artefact. L'identifiant figure après « id: » dans la base.
- creer_projet : quand il veut ouvrir un nouveau projet.
N'enregistre et ne modifie rien qu'il n'a pas demandé. Après une action, confirme en une phrase. Les dates relatives (« demain », « vendredi ») se calculent à partir de la date du jour donnée plus bas.

Tu peux chercher sur le web quand la question porte sur une information extérieure ou récente ; ne le fais pas pour ce qui se trouve déjà dans la base.`;

const ACTION_TOOLS = ["memoriser", "modifier", "creer_projet"];
const CLIENT_TOOLS: Anthropic.Beta.BetaTool[] = TOOLS.filter((t) => ACTION_TOOLS.includes(t.name)).map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: t.inputSchema,
  eager_input_streaming: true,
}));

interface ChatBody {
  messages: { role: "user" | "assistant"; content: string }[];
  /** Mémoire gardée dans le navigateur quand le serveur n'a pas de stockage. */
  localState?: unknown;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY n'est pas défini : le chat intégré est désactivé." }, { status: 503 });
  }
  const body = (await req.json()) as ChatBody;
  const history = (body.messages ?? []).filter((m) => m.content?.trim()).slice(-40);
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return Response.json({ error: "Message manquant." }, { status: 400 });
  }
  // Mêmes règles dans les deux cas ; seul l'endroit où l'on écrit change.
  const local = isPersistent() ? null : localOps(body.localState);
  const ops: Ops = local ?? storeOps;
  const [neurons, projects] = await Promise.all([ops.neurons(), ops.projects()]);
  const now = new Date();
  const today = isoDay(now);
  const a = agenda(neurons, today);
  const open = [...a.late, ...a.today, ...a.week, ...a.later, ...a.undated];
  const volatile = [
    `Nous sommes le ${now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} (${today}).`,
    open.length ? `Tâches ouvertes, par urgence :\n${open.slice(0, 40).map(formatNeuron).join("\n")}` : "Aucune tâche ouverte.",
  ].join("\n\n");

  const client = new Anthropic();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
      let useSearch = status().webSearch;
      let sentText = false;
      let acted = false;
      try {
        // Boucle d'agent : on relance tant que Claude appelle un outil.
        for (let turn = 0; turn < 8; turn++) {
          const tools: Anthropic.Beta.BetaToolUnion[] = [...CLIENT_TOOLS];
          if (useSearch) tools.push({ type: "web_search_20260209", name: "web_search", max_uses: 3 });
          let message: Anthropic.Beta.BetaMessage;
          try {
            const run = client.beta.messages.stream({
              model: MODEL,
              max_tokens: 16000,
              // Bascule automatique sur un autre modèle si une requête est déclinée.
              betas: ["server-side-fallback-2026-07-01"],
              fallbacks: "default",
              output_config: { effort: "medium" },
              system: [
                // Préfixe stable (mis en cache) puis la date et les tâches, volatiles, après le point de cache.
                { type: "text", text: `${SYSTEM}\n\n# Base de neurones\n\n${toContext(neurons, projects)}`, cache_control: { type: "ephemeral" } },
                { type: "text", text: volatile },
              ],
              tools,
              messages,
            });
            for await (const event of run) {
              if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
                sentText = true;
                send({ type: "text", delta: event.delta.text });
              } else if (event.type === "content_block_start" && event.content_block.type === "server_tool_use") {
                send({ type: "status", text: "Recherche sur le web…" });
              }
            }
            message = await run.finalMessage();
          } catch (e) {
            // Recherche web indisponible sur ce compte : on continue sans elle.
            if (useSearch && !sentText && e instanceof Anthropic.BadRequestError) {
              useSearch = false;
              turn--;
              continue;
            }
            throw e;
          }
          if (message.stop_reason === "refusal") {
            send({ type: "error", message: "Jarvis ne peut pas répondre à cette demande." });
            break;
          }
          // Un outil serveur a atteint sa limite d'itérations : on renvoie le tour pour qu'il se poursuive.
          if (message.stop_reason === "pause_turn") {
            messages.push({ role: "assistant", content: message.content });
            continue;
          }
          const calls = message.content.filter((b) => b.type === "tool_use");
          // Une entrée d'outil coupée par max_tokens peut sembler valide : on ne l'exécute pas.
          if (calls.length === 0 || message.stop_reason === "max_tokens") break;
          messages.push({ role: "assistant", content: message.content });
          const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
          for (const call of calls) {
            try {
              const input = call.input as Record<string, unknown>;
              if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Entrée d'outil invalide.");
              if (!ACTION_TOOLS.includes(call.name)) throw new Error(`Outil inconnu : ${call.name}`);
              // runTool valide chaque champ (titre, lien, échéance…) avant d'écrire.
              const text = await runTool(ops, call.name, input);
              acted = true;
              send({ type: "action", text: text.split("\n")[0].replace(/ · id:.*$/, "").replace(/^(\S+ :) - \[[^\]]+\] /, "$1 ") });
              results.push({ type: "tool_result", tool_use_id: call.id, content: text });
            } catch (e) {
              results.push({ type: "tool_result", tool_use_id: call.id, content: (e as Error).message, is_error: true });
            }
          }
          messages.push({ role: "user", content: results });
        }
      } catch (e) {
        send({ type: "error", message: describe(e) });
      } finally {
        // L'interface se met à jour : nouvel état local, ou rechargement depuis le serveur.
        if (acted) send(local ? { type: "state", state: local.current() } : { type: "refresh" });
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

function describe(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "Clé API Anthropic refusée : vérifie ANTHROPIC_API_KEY.";
  if (e instanceof Anthropic.RateLimitError) return "Limite de débit atteinte, réessaie dans un instant.";
  if (e instanceof Anthropic.APIConnectionError) return "Connexion à l'API Claude impossible.";
  if (e instanceof Anthropic.APIError) return `Erreur de l'API Claude (${e.status ?? "?"}) : ${e.message}`;
  return `Erreur inattendue : ${(e as Error).message}`;
}
