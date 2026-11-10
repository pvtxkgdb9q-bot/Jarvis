import { NextResponse, type NextRequest } from "next/server";
import { isAuthed, SESSION_COOKIE } from "./lib/auth.ts";

// Verrouille toute l'application derrière le mot de passe. Le connecteur MCP
// (/api/mcp/<jeton>) a sa propre authentification par jeton secret.
export async function proxy(req: NextRequest) {
  if (await isAuthed(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/auth|api/mcp|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
