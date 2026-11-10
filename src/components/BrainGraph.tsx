"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildGraph, normalize, projectName, type GraphNode } from "@/lib/brain";
import { KIND_LABEL, TYPE_LABEL } from "@/lib/types";
import { Icon, ProjectChip, relDate } from "./ui";
import type { Brain } from "./useBrain";

interface P extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fixed?: boolean;
}

/** Graphe de forces dessiné sur canvas : noyau → projets → neurones. */
export function BrainGraph({ brain, onOpenProject }: { brain: Brain; onOpenProject: (id: string) => void }) {
  const { neurons, projects } = brain;
  const graph = useMemo(() => buildGraph(neurons, projects), [neurons, projects]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const sim = useRef({ nodes: [] as P[], byId: new Map<string, P>(), alpha: 1, tx: 0, ty: 0, k: 1, hover: null as P | null, raf: 0 });
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [query, setQuery] = useState("");
  const state = useRef({ selected: null as GraphNode | null, query: "" });
  state.current = { selected, query: normalize(query) };

  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of graph.links) {
      (m.get(l.source) ?? m.set(l.source, new Set()).get(l.source)!).add(l.target);
      (m.get(l.target) ?? m.set(l.target, new Set()).get(l.target)!).add(l.source);
    }
    return m;
  }, [graph]);

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext("2d")!;
    const s = sim.current;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Conserve les positions des nœuds déjà placés quand la base change.
    const old = s.byId;
    const projectsN = graph.nodes.filter((n) => n.kind === "project");
    s.nodes = graph.nodes.map((n) => {
      const prev = old.get(n.id);
      if (prev) return { ...prev, ...n };
      if (n.kind === "core") return { ...n, x: 0, y: 0, vx: 0, vy: 0 };
      const pi = projectsN.findIndex((p) => p.projectId === n.projectId);
      const a = (pi / Math.max(1, projectsN.length)) * Math.PI * 2;
      const r = n.kind === "project" ? 230 : 300 + Math.random() * 60;
      return { ...n, x: Math.cos(a) * r + (Math.random() - 0.5) * 40, y: Math.sin(a) * r + (Math.random() - 0.5) * 40, vx: 0, vy: 0 };
    });
    s.byId = new Map(s.nodes.map((n) => [n.id, n]));
    s.alpha = 1;
    const links = graph.links.map((l) => ({ a: s.byId.get(l.source)!, b: s.byId.get(l.target)!, strength: l.strength }));

    let w = 0, h = 0;
    const resize = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.k = Math.min(1, Math.min(w, h) / 820);
      wake();
    };

    function step() {
      const ns = s.nodes;
      for (let i = 0; i < ns.length; i++) {
        const a = ns[i];
        for (let j = i + 1; j < ns.length; j++) {
          const b = ns[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
          if (d2 > 90000) continue;
          const f = ((a.kind === "neuron" && b.kind === "neuron" ? 900 : 2600) / d2) * s.alpha;
          const d = Math.sqrt(d2);
          a.vx -= (dx / d) * f; a.vy -= (dy / d) * f;
          b.vx += (dx / d) * f; b.vy += (dy / d) * f;
        }
      }
      for (const l of links) {
        const dx = l.b.x - l.a.x, dy = l.b.y - l.a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const rest = l.a.kind === "core" ? 210 : l.strength === 1 ? 62 : 260;
        const f = (d - rest) * 0.04 * l.strength * s.alpha;
        l.a.vx += (dx / d) * f; l.a.vy += (dy / d) * f;
        l.b.vx -= (dx / d) * f; l.b.vy -= (dy / d) * f;
      }
      for (const n of ns) {
        if (n.fixed || n.kind === "core") { n.vx = n.vy = 0; continue; }
        n.vx *= 0.62; n.vy *= 0.62;
        n.x += n.vx; n.y += n.vy;
      }
      s.alpha *= 0.985;
    }

    function draw() {
      const { selected, query } = state.current;
      const focus = s.hover ?? (selected ? s.byId.get(selected.id) ?? null : null);
      const near = focus ? neighbors.get(focus.id) : null;
      const lit = (n: P) => {
        if (query) return normalize(n.label).includes(query) || n.kind === "core";
        if (!focus) return true;
        return n === focus || Boolean(near?.has(n.id));
      };
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2 + s.tx, h / 2 + s.ty);
      ctx.scale(s.k, s.k);
      for (const l of links) {
        const on = focus ? l.a === focus || l.b === focus : !query;
        ctx.strokeStyle = `hsla(${l.b.hue}, 70%, 65%, ${on ? (l.strength < 1 && l.a.kind === "neuron" ? 0.16 : 0.42) : 0.05})`;
        ctx.lineWidth = (l.a.kind === "core" ? 1.4 : 0.9) / s.k;
        ctx.beginPath();
        ctx.moveTo(l.a.x, l.a.y);
        ctx.lineTo(l.b.x, l.b.y);
        ctx.stroke();
      }
      for (const n of s.nodes) {
        const on = lit(n);
        ctx.globalAlpha = on ? 1 : 0.14;
        if (n.kind !== "neuron" || n === focus) {
          const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.size * 3);
          g.addColorStop(0, `hsla(${n.hue}, 90%, 62%, 0.32)`);
          g.addColorStop(1, `hsla(${n.hue}, 90%, 62%, 0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.size * 3, 0, 7);
          ctx.fill();
        }
        ctx.fillStyle = n.kind === "core" ? "#eaf7ff" : `hsl(${n.hue}, 82%, ${n.kind === "project" ? 62 : 70}%)`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size, 0, 7);
        ctx.fill();
        if (selected?.id === n.id) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2 / s.k;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.size + 4 / s.k, 0, 7);
          ctx.stroke();
        }
        const showLabel = n.kind !== "neuron" || n === focus || (on && (query || focus)) || s.k > 1.7;
        if (showLabel && on) {
          const fs = (n.kind === "core" ? 13 : n.kind === "project" ? 12 : 11) / s.k;
          ctx.font = `${n.kind === "neuron" ? 400 : 600} ${fs}px ui-sans-serif, system-ui, sans-serif`;
          ctx.textAlign = "center";
          const text = n.label.length > 34 ? n.label.slice(0, 33) + "…" : n.label;
          const y = n.y + n.size + fs * 1.25;
          ctx.lineWidth = 4 / s.k;
          ctx.strokeStyle = "rgba(6, 10, 17, 0.9)";
          ctx.strokeText(text, n.x, y);
          ctx.fillStyle = n.kind === "neuron" ? "#c3d0e0" : "#f2f7fd";
          ctx.fillText(text, n.x, y);
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    function frame() {
      if (s.alpha > 0.02) step();
      draw();
      s.raf = s.alpha > 0.02 ? requestAnimationFrame(frame) : 0;
    }
    function wake(alpha = 0) {
      s.alpha = Math.max(s.alpha, alpha);
      if (reduced) {
        while (s.alpha > 0.02) step();
        draw();
      } else if (!s.raf) s.raf = requestAnimationFrame(frame);
    }
    (s as typeof s & { wake?: typeof wake }).wake = wake;

    const toWorld = (e: PointerEvent | WheelEvent) => {
      const r = cv.getBoundingClientRect();
      return { x: (e.clientX - r.left - w / 2 - s.tx) / s.k, y: (e.clientY - r.top - h / 2 - s.ty) / s.k };
    };
    const hit = (e: PointerEvent) => {
      const p = toWorld(e);
      let best: P | null = null, bd = Infinity;
      for (const n of s.nodes) {
        const d = Math.hypot(n.x - p.x, n.y - p.y);
        if (d < Math.max(n.size + 5, 12 / s.k) && d < bd) { best = n; bd = d; }
      }
      return best;
    };

    let drag: { node: P | null; x: number; y: number; moved: boolean } | null = null;
    const down = (e: PointerEvent) => {
      cv.setPointerCapture(e.pointerId);
      drag = { node: hit(e), x: e.clientX, y: e.clientY, moved: false };
    };
    const move = (e: PointerEvent) => {
      if (!drag) {
        const n = hit(e);
        if (n !== s.hover) { s.hover = n; cv.style.cursor = n ? "pointer" : "grab"; wake(); }
        return;
      }
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      drag.x = e.clientX; drag.y = e.clientY;
      if (drag.node && drag.node.kind !== "core") {
        drag.node.fixed = true;
        drag.node.x += dx / s.k; drag.node.y += dy / s.k;
        wake(0.3);
      } else { s.tx += dx; s.ty += dy; wake(); }
    };
    const up = () => {
      if (drag) {
        if (drag.node) drag.node.fixed = false;
        if (!drag.moved) setSelected(drag.node && drag.node.kind !== "core" ? drag.node : null);
      }
      drag = null;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const before = toWorld(e);
      s.k = Math.min(4, Math.max(0.3, s.k * Math.exp(-e.deltaY * 0.0015)));
      const after = toWorld(e);
      s.tx += (after.x - before.x) * s.k; s.ty += (after.y - before.y) * s.k;
      wake();
    };
    const leave = () => { if (s.hover) { s.hover = null; wake(); } };

    const ro = new ResizeObserver(resize);
    ro.observe(cv);
    cv.addEventListener("pointerdown", down);
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    cv.addEventListener("pointerleave", leave);
    cv.addEventListener("wheel", wheel, { passive: false });
    return () => {
      ro.disconnect();
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      cv.removeEventListener("pointerdown", down);
      cv.removeEventListener("pointermove", move);
      cv.removeEventListener("pointerup", up);
      cv.removeEventListener("pointercancel", up);
      cv.removeEventListener("pointerleave", leave);
      cv.removeEventListener("wheel", wheel);
    };
  }, [graph, neighbors]);

  // Redessine quand la sélection ou la recherche change.
  useEffect(() => {
    (sim.current as typeof sim.current & { wake?: () => void }).wake?.();
  }, [selected, query]);

  const zoom = (f: number) => {
    const s = sim.current;
    s.k = Math.min(4, Math.max(0.3, s.k * f));
    (s as typeof s & { wake?: () => void }).wake?.();
  };
  const sel = selected;
  const members = sel?.kind === "project" ? neurons.filter((n) => (n.project || "_libre") === sel.projectId) : [];
  const linked = sel?.kind === "neuron" ? [...(neighbors.get(sel.id) ?? [])].map((id) => graph.nodes.find((n) => n.id === id)!).filter((n) => n.kind === "neuron") : [];

  return (
    <div className="view graph-view">
      <header className="view-head">
        <h1>Cerveau</h1>
        <p className="lede">{neurons.length} neurones, {graph.links.length} synapses. Clique un nœud, fais glisser pour explorer, molette pour zoomer.</p>
      </header>
      <div className="graph">
        <canvas ref={canvas} role="img" aria-label={`Graphe de la base de neurones : ${neurons.length} neurones répartis en ${graph.nodes.filter((n) => n.kind === "project").length} projets. La bibliothèque en donne la liste complète.`} />
        <label className="search graph-search">
          <Icon name="search" size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Illuminer des neurones…" aria-label="Rechercher dans le graphe" />
        </label>
        <div className="graph-zoom">
          <button className="icon-btn" onClick={() => zoom(1.3)} aria-label="Zoomer">+</button>
          <button className="icon-btn" onClick={() => zoom(1 / 1.3)} aria-label="Dézoomer">−</button>
        </div>
        {sel && sel.kind !== "core" && (
          <aside className="card graph-panel">
            <button className="icon-btn close" onClick={() => setSelected(null)} aria-label="Fermer"><Icon name="close" size={16} /></button>
            {sel.kind === "project" ? (
              <>
                <span className="kind">Projet · {members.length} neurones</span>
                <h3>{sel.label}</h3>
                <p className="content">{projects.find((p) => p.id === sel.projectId)?.summary}</p>
                <ul className="mini">
                  {members.slice(0, 8).map((n) => (
                    <li key={n.id}>{n.url ? <a href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a> : n.title}</li>
                  ))}
                </ul>
                <button className="btn" onClick={() => onOpenProject(sel.projectId!)}>Voir dans la bibliothèque</button>
              </>
            ) : (
              sel.neuron && (
                <>
                  <span className="kind">{sel.neuron.kind ? KIND_LABEL[sel.neuron.kind] : TYPE_LABEL[sel.neuron.type]} · {relDate(sel.neuron.updatedAt)}</span>
                  <h3>{sel.neuron.title}</h3>
                  {sel.neuron.content && <p className="content">{sel.neuron.content}</p>}
                  <div className="chips">
                    <ProjectChip id={sel.neuron.project} projects={projects} />
                    {sel.neuron.tags.map((t) => <span key={t} className="tag">#{t}</span>)}
                  </div>
                  {linked.length > 0 && (
                    <>
                      <span className="kind">Synapses vers d&apos;autres projets</span>
                      <ul className="mini">
                        {linked.slice(0, 5).map((n) => (
                          <li key={n.id}><button className="linklike" onClick={() => setSelected(n)}>{n.label}</button> <span className="muted">· {projectName(n.projectId, projects)}</span></li>
                        ))}
                      </ul>
                    </>
                  )}
                  {sel.neuron.url && (
                    <a className="btn primary" href={sel.neuron.url} target="_blank" rel="noopener noreferrer"><Icon name="open" size={16} /> Ouvrir</a>
                  )}
                </>
              )
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
