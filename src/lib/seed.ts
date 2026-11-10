import artifacts from "../../data/artifacts.json" with { type: "json" };
import projectsJson from "../../data/projects.json" with { type: "json" };
import sites from "../../data/sites.json" with { type: "json" };
import type { Kind, Neuron, Project } from "./types.ts";

export const PROJECTS: Project[] = projectsJson;

interface SeedSite {
  id: string;
  name: string;
  url: string;
  project?: string;
  framework?: string;
  repo?: string;
  updated: string;
}

export function siteToNeuron(s: SeedSite, source: "seed" | "vercel" = "seed"): Neuron {
  const tags = ["vercel", "site"];
  if (s.framework) tags.push(s.framework);
  return {
    id: `site-${s.id}`,
    type: "site",
    kind: "site",
    title: s.name,
    url: s.url,
    project: s.project,
    content: s.repo ? `Dépôt : ${s.repo}` : undefined,
    tags,
    createdAt: s.updated,
    updatedAt: s.updated,
    source,
  };
}

export const SEED_NEURONS: Neuron[] = [
  ...artifacts.map(
    (a): Neuron => ({
      id: `art-${a.id}`,
      type: "artifact",
      kind: a.kind as Kind,
      title: a.title,
      url: `https://claude.ai/artifact/${a.id}`,
      project: a.project,
      tags: a.tags,
      createdAt: `${a.updated}T12:00:00.000Z`,
      updatedAt: `${a.updated}T12:00:00.000Z`,
      source: "seed",
    }),
  ),
  ...(sites as SeedSite[]).map((s) => siteToNeuron(s)),
];
