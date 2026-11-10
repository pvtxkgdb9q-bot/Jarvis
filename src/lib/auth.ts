// Authentification minimale à mot de passe unique (un seul utilisateur).
// Le cookie de session est un HMAC du mot de passe : changer le mot de passe
// invalide toutes les sessions. Web Crypto → compatible proxy et routes.
export const SESSION_COOKIE = "jarvis_session";

const enc = new TextEncoder();

async function hmac(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function password(): string | undefined {
  return process.env.JARVIS_PASSWORD?.trim() || undefined;
}

/** En développement sans mot de passe, l'accès est ouvert ; en production, verrouillé. */
export function authDisabled(): boolean {
  return !password() && process.env.NODE_ENV !== "production";
}

export async function sessionToken(): Promise<string | undefined> {
  const pw = password();
  return pw ? hmac(pw, "jarvis-session-v1") : undefined;
}

/** Comparaison à temps constant (via HMAC des deux côtés). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([hmac("cmp", a), hmac("cmp", b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

export async function isAuthed(cookieValue: string | undefined): Promise<boolean> {
  if (authDisabled()) return true;
  const expected = await sessionToken();
  if (!expected || !cookieValue) return false;
  return safeEqual(cookieValue, expected);
}
