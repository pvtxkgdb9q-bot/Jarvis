import { NextResponse } from "next/server";
import { password, safeEqual, SESSION_COOKIE, sessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  const pw = password();
  if (!pw) {
    return NextResponse.json(
      { error: "JARVIS_PASSWORD n'est pas défini sur le serveur : ajoute-le dans les variables d'environnement Vercel." },
      { status: 503 },
    );
  }
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  // Petit délai fixe : freine le bruteforce sans état serveur.
  await new Promise((r) => setTimeout(r, 400));
  if (typeof body.password !== "string" || !(await safeEqual(body.password, pw))) {
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }
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
