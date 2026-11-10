import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/auth";
import { handleRpc } from "@/lib/mcp";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

async function authorized(token: string): Promise<boolean> {
  const expected = process.env.JARVIS_MCP_TOKEN?.trim();
  return Boolean(expected) && expected!.length >= 16 && (await safeEqual(token, expected!));
}

export async function POST(req: Request, { params }: Ctx) {
  if (!(await authorized((await params).token))) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON invalide." } }, { status: 400 });
  }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleRpc(m)))).filter(Boolean);
    return out.length ? NextResponse.json(out) : new Response(null, { status: 202 });
  }
  const res = await handleRpc(body as Parameters<typeof handleRpc>[0]);
  return res ? NextResponse.json(res) : new Response(null, { status: 202 });
}

// Serveur sans état : pas de flux SSE initié par le serveur, pas de session.
export async function GET(_req: Request, { params }: Ctx) {
  if (!(await authorized((await params).token))) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
