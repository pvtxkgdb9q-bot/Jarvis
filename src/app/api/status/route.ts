import { NextResponse } from "next/server";
import { status } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const token = process.env.JARVIS_MCP_TOKEN;
  // Route protégée par la session : on peut y afficher l'URL du connecteur.
  return NextResponse.json({ ...status(), mcpUrl: token ? `${origin}/api/mcp/${token}` : null });
}
