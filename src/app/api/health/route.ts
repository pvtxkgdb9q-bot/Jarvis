import { NextResponse } from "next/server";
import { baseNeurons } from "@/lib/store";
import type { SiteHealth } from "@/lib/types";

export const dynamic = "force-dynamic";

let cache: { at: number; data: Record<string, SiteHealth> } | null = null;

async function check(url: string): Promise<SiteHealth> {
  const t = Date.now();
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(6000), cache: "no-store", headers: { "User-Agent": "jarvis-health-check" } });
    const ms = Date.now() - t;
    // 401/403 : le site répond mais demande une authentification.
    const state = res.ok ? "up" : res.status === 401 || res.status === 403 ? "protected" : "down";
    return { state, status: res.status, ms };
  } catch {
    return { state: "down", status: 0, ms: Date.now() - t };
  }
}

// Seuls les sites de la base fixe sont interrogés : jamais une adresse libre.
export async function GET() {
  if (cache && Date.now() - cache.at < 5 * 60_000) return NextResponse.json({ sites: cache.data, cached: true });
  const sites = (await baseNeurons()).filter((n) => n.type === "site" && n.url?.startsWith("https://"));
  const results = await Promise.all(sites.map((n) => check(n.url!)));
  const data = Object.fromEntries(sites.map((n, i) => [n.id, results[i]]));
  cache = { at: Date.now(), data };
  return NextResponse.json({ sites: data, cached: false });
}
