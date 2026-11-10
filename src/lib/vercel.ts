import { siteToNeuron } from "./seed.ts";
import type { Neuron } from "./types.ts";

interface VercelProject {
  id: string;
  name: string;
  framework?: string | null;
  updatedAt?: number;
  link?: { org?: string; repo?: string };
  targets?: { production?: { alias?: string[] } };
}

/**
 * Liste en direct les projets Vercel si VERCEL_TOKEN est défini (cache 10 min).
 * Renvoie null si la synchronisation n'est pas configurée ou échoue : on
 * retombe alors sur data/sites.json.
 */
export async function liveVercelSites(): Promise<Neuron[] | null> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) return null;
  try {
    const qs = new URLSearchParams({ limit: "100" });
    if (process.env.VERCEL_TEAM_ID) qs.set("teamId", process.env.VERCEL_TEAM_ID);
    const res = await fetch(`https://api.vercel.com/v10/projects?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { projects?: VercelProject[] };
    return (data.projects ?? []).map((p) => {
      const aliases = p.targets?.production?.alias ?? [];
      const host = aliases.find((a) => !a.includes("-git-")) ?? aliases[0] ?? `${p.name}.vercel.app`;
      return siteToNeuron(
        {
          id: p.id,
          name: p.name,
          url: `https://${host}`,
          framework: p.framework ?? undefined,
          repo: p.link?.org && p.link.repo ? `${p.link.org}/${p.link.repo}` : undefined,
          updated: new Date(p.updatedAt ?? Date.now()).toISOString(),
        },
        "vercel",
      );
    });
  } catch {
    return null;
  }
}
