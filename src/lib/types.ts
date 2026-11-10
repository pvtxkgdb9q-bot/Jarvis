export type NeuronType = "artifact" | "site" | "note" | "task" | "idea" | "link";
export type Kind = "app" | "site" | "doc" | "cdc" | "fiche" | "guide" | "3d" | "planning";
export type Source = "seed" | "vercel" | "user" | "claude";

/** Un neurone = une unité de connaissance de la base (artefact, site, note, tâche…). */
export interface Neuron {
  id: string;
  type: NeuronType;
  title: string;
  content?: string;
  url?: string;
  /** Identifiant d'un projet connu, ou nom libre. */
  project?: string;
  kind?: Kind;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  source: Source;
  done?: boolean;
}

export interface Project {
  id: string;
  name: string;
  hue: number;
  summary: string;
}

export interface NeuronInput {
  type?: NeuronType;
  title?: string;
  content?: string;
  url?: string;
  project?: string;
  tags?: string[];
  done?: boolean;
}

export interface Status {
  persistent: boolean;
  chat: boolean;
  mcp: boolean;
  vercelLive: boolean;
  model: string;
}

export const TYPE_LABEL: Record<NeuronType, string> = {
  artifact: "Artefact",
  site: "Site",
  note: "Note",
  task: "Tâche",
  idea: "Idée",
  link: "Lien",
};

export const KIND_LABEL: Record<Kind, string> = {
  app: "Application",
  site: "Site web",
  doc: "Document",
  cdc: "Cahier des charges",
  fiche: "Fiche",
  guide: "Guide",
  "3d": "Modèle 3D",
  planning: "Planning",
};

export const USER_TYPES: NeuronType[] = ["note", "task", "idea", "link"];
