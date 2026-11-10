"use client";
import type { ReactNode } from "react";
import { projectName } from "@/lib/brain";
import { KIND_LABEL, TYPE_LABEL, type Neuron, type Project } from "@/lib/types";

const PATHS: Record<string, string> = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  library: "M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z",
  brain: "M12 5a3 3 0 100 6 3 3 0 000-6zM5 16a2 2 0 100 4 2 2 0 000-4zM19 16a2 2 0 100 4 2 2 0 000-4zM10 10l-4 6M14 10l4 6M7 18h10",
  chat: "M4 5h16v11H9l-5 4z",
  memory: "M6 3h12v18l-6-4-6 4z",
  link: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM16 16l5 5",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.200 9.5l6.100-.9z",
  open: "M14 4h6v6M20 4l-9 9M18 13v7H4V6h7",
  plus: "M12 5v14M5 12h14",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  edit: "M4 20h4L20 8l-4-4L4 16z",
  mic: "M12 3a3 3 0 00-3 3v5a3 3 0 006 0V6a3 3 0 00-3-3zM5 11a7 7 0 0014 0M12 18v3",
  sound: "M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 010 6",
  send: "M4 12l16-8-6 16-3-7z",
  close: "M6 6l12 12M18 6L6 18",
  check: "M5 12l5 5 9-10",
  copy: "M8 8h11v12H8zM5 16V4h11",
  logout: "M10 4H5v16h5M14 8l4 4-4 4M18 12H9",
};

export function Icon({ name, size = 18 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

export function relDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 30) return `il y a ${days} j`;
  if (days < 365) return `il y a ${Math.floor(days / 30)} mois`;
  return new Date(iso).toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
}

export function hueOfProject(id: string | undefined, projects: Project[]): number {
  const p = projects.find((x) => x.id === id);
  if (p) return p.hue;
  let h = 0;
  for (const c of id ?? "") h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function ProjectChip({ id, projects, onClick }: { id?: string; projects: Project[]; onClick?: () => void }) {
  if (!id) return null;
  const style = { "--h": hueOfProject(id, projects) } as React.CSSProperties;
  const label = projectName(id, projects);
  return onClick ? (
    <button className="chip chip-project" style={style} onClick={onClick}>{label}</button>
  ) : (
    <span className="chip chip-project" style={style}>{label}</span>
  );
}

export function NeuronCard({ n, projects, favorite, onFavorite, onProject, actions }: {
  n: Neuron;
  projects: Project[];
  favorite: boolean;
  onFavorite: () => void;
  onProject?: (id: string) => void;
  actions?: ReactNode;
}) {
  const label = n.kind ? KIND_LABEL[n.kind] : TYPE_LABEL[n.type];
  return (
    <article className={`card neuron ${n.done ? "is-done" : ""}`} style={{ "--h": hueOfProject(n.project, projects) } as React.CSSProperties}>
      <header>
        <span className="kind">{label}</span>
        <span className="date">{relDate(n.updatedAt)}</span>
        <button className={`icon-btn star ${favorite ? "on" : ""}`} onClick={onFavorite} aria-pressed={favorite} aria-label={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}>
          <Icon name="star" size={16} />
        </button>
      </header>
      <h3>
        {n.url ? (
          <a href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a>
        ) : (
          n.title
        )}
      </h3>
      {n.content && <p className="content">{n.content}</p>}
      <footer>
        <ProjectChip id={n.project} projects={projects} onClick={onProject && n.project ? () => onProject(n.project!) : undefined} />
        {n.tags.slice(0, 3).map((t) => (
          <span key={t} className="tag">#{t}</span>
        ))}
        <span className="spacer" />
        {actions}
        {n.url && (
          <a className="icon-btn" href={n.url} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir ${n.title}`}>
            <Icon name="open" size={16} />
          </a>
        )}
      </footer>
    </article>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}
