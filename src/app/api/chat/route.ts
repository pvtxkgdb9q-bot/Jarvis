import Anthropic from "@anthropic-ai/sdk";
import { makeNeuron, toContext } from "@/lib/brain";
import { PROJECTS } from "@/lib/seed";
import { addNeuron, allNeurons, isPersistent, MODEL } from "@/lib/store";
import type { Neuron, NeuronInput } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SYSTEM = `Tu es Jarvis, l'assistant personnel de l'utilisateur. Tu parles français, tu le tutoies, et tu vas droit au but : réponses courtes par défaut, détaillées quand la question le demande.

Tu disposes de sa « base de neurones » ci-dessous : ses artefacts Claude, ses sites Vercel, ses projets, et les notes, tâches, idées et liens qu'il t'a confiés. C'est ta mémoire de lui. Appuie-toi dessus pour répondre, relie les éléments entre eux quand c'est utile (par exemple un cahier des charges et l'application qui en découle), et donne le lien d'un élément quand tu le cites — en Markdown, [titre](url).

Les artefacts ne sont connus que par leur titre, leur projet et leurs étiquettes : tu n'as pas leur contenu. Si une question porte sur le contenu d'un artefact, dis-le simplement et propose de l'ouvrir.

Quand il te demande de retenir, noter ou planifier quelque chose, appelle l'outil memoriser (une note, une tâche, une idée ou un lien), puis confirme en une phrase. N'enregistre rien qu'il n'a pas demandé de garder.`;

const TOOL: Anthropic.Tool = {
  name: "memoriser",
  description: "Ajoute un neurone durable à la base de l'utilisateur : note, tâche, idée ou lien.",
  eager_input_streaming: true,
  input_schema: {
    type: "object",
    properties: {
      type: { type: "string", enum: ["note", "task", "idea", "link"] },
      title: { type: "string", description: "Titre court et précis." },
      content: { type: "string", description: "Détail (facultatif)." },
      url: { type: "string", description: "Lien http(s) (facultatif)." },
      project: { type: "string", description: "Identifiant d'un projet existant, ou nom libre." },
      tags: { type: "array", items: { type: "string" } },
    },
    required: ["title"],
  },
};

interface ChatBody {
  messages: { role: "user" | "assistant"; content: string }[];
  /** Neurones gardés dans le navigateur quand le serveur n'a pas de stockage. */
  localNeurons?: Neuron[];
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
  const neurons = [...(await allNeurons()), ...(isPersistent() ? [] : (body.localNeurons ?? []).slice(0, 500))];
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const client = new Anthropic();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
      try {
        // Boucle d'agent : on relance tant que Claude appelle l'outil memoriser.
        for (let turn = 0; turn < 6; turn++) {
          const run = client.beta.messages.stream({
            model: MODEL,
            max_tokens: 16000,
            // Bascule automatique sur un autre modèle si une requête est déclinée.
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            output_config: { effort: "medium" },
            system: [
              // Préfixe stable (mis en cache) puis la date, volatile, après le point de cache.
              { type: "text", text: `${SYSTEM}\n\n# Base de neurones\n\n${toContext(neurons, PROJECTS)}`, cache_control: { type: "ephemeral" } },
              { type: "text", text: `Nous sommes le ${today}.` },
            ],
            tools: [TOOL],
            messages,
          });
          run.on("text", (delta) => send({ type: "text", delta }));
          const message = await run.finalMessage();
          if (message.stop_reason === "refusal") {
            send({ type: "error", message: "Jarvis ne peut pas répondre à cette demande." });
            break;
          }
          const calls = message.content.filter((b) => b.type === "tool_use");
          // Une entrée d'outil coupée par max_tokens peut sembler valide : on ne l'exécute pas.
          if (calls.length === 0 || message.stop_reason === "max_tokens") break;
          messages.push({ role: "assistant", content: message.content });
          const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
          for (const call of calls) {
            try {
              const input = call.input as NeuronInput;
              if (!input || typeof input.title !== "string") throw new Error("Entrée invalide : « title » manquant.");
              const neuron = isPersistent() ? await addNeuron(input, "claude") : makeNeuron(input, "claude");
              send({ type: "neuron", neuron, persisted: isPersistent() });
              results.push({ type: "tool_result", tool_use_id: call.id, content: `Mémorisé (id: ${neuron.id}).` });
            } catch (e) {
              results.push({ type: "tool_result", tool_use_id: call.id, content: (e as Error).message, is_error: true });
            }
          }
          messages.push({ role: "user", content: results });
        }
      } catch (e) {
        send({ type: "error", message: describe(e) });
      } finally {
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
