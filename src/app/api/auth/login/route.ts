import { NextResponse } from "next/server";
import { password, safeEqual, SESSION_COOKIE, sessionToken } from "@/lib/auth";

// Limitation des tentatives, en mémoire de l'instance : 8 échecs en 10 minutes
// par adresse. (Une instance neuve repart de zéro : c'est un frein, pas un coffre.)
const WINDOW = 10 * 60_000;
const MAX = 8;
const failures = new Map<string, number[]>();

export async function POST(req: Request) {
  const pw = password();
  if (!pw) {
    return NextResponse.json(
      { error: "JARVIS_PASSWORD n'est pas défini sur le serveur : ajoute-le dans les variables d'environnement Vercel." },
      { status: 503 },
    );
  }
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "inconnu";
  const now = Date.now();
  const recent = (failures.get(ip) ?? []).filter((t) => now - t < WINDOW);
  if (recent.length >= MAX) {
    return NextResponse.json({ error: "Trop de tentatives. Réessaie dans 10 minutes." }, { status: 429 });
  }
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  // Petit délai fixe : freine encore le bruteforce.
  await new Promise((r) => setTimeout(r, 400));
  if (typeof body.password !== "string" || !(await safeEqual(body.password, pw))) {
    failures.set(ip, [...recent, now]);
    if (failures.size > 5000) failures.clear();
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }
  failures.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, (await sessionToken())!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  return res;
}
