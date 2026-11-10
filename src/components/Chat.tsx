"use client";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./ui";
import type { Brain } from "./useBrain";

interface Msg {
  role: "user" | "assistant";
  content: string;
  saved?: string[];
  error?: boolean;
}
const KEY = "jarvis.chat.v1";
const SUGGESTIONS = [
  "Fais-moi un point sur mes projets en cours.",
  "Quels cahiers des charges ai-je écrits, et pour quelles applications ?",
  "Retrouve tout ce qui concerne la SAE 3.1.",
  "Note que je dois préparer la prochaine revue de projet.",
];

/** Rendu Markdown minimal et sûr (aucun HTML injecté) : gras, code, liens, listes, titres. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={i++}>{m[1]}</strong>);
    else if (m[2]) out.push(<code key={i++}>{m[2]}</code>);
    else out.push(<a key={i++} href={m[4] ?? m[5]} target="_blank" rel="noopener noreferrer">{m[3] ?? m[5]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={blocks.length}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>);
    list = [];
  };
  for (const line of text.split("\n")) {
    const li = /^\s*(?:[-*•]|\d+\.)\s+(.*)/.exec(line);
    const h = /^#{1,4}\s+(.*)/.exec(line);
    if (li) list.push(li[1]);
    else {
      flush();
      if (h) blocks.push(<h4 key={blocks.length}>{inline(h[1])}</h4>);
      else if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line)}</p>);
    }
  }
  flush();
  return <Fragment>{blocks}</Fragment>;
}

type Recognition = { lang: string; interimResults: boolean; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onend: () => void; start: () => void; stop: () => void };

export function Chat({ brain, pending, clearPending }: { brain: Brain; pending: string | null; clearPending: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [speak, setSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const rec = useRef<Recognition | null>(null);
  const abort = useRef<AbortController | null>(null);
  const enabled = brain.status?.chat ?? true;

  useEffect(() => {
    try {
      setMsgs(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
    } catch { /* historique illisible : on repart de zéro */ }
    setCanListen("webkitSpeechRecognition" in window || "SpeechRecognition" in window);
    return () => {
      abort.current?.abort();
      speechSynthesis?.cancel();
    };
  }, []);
  useEffect(() => {
    if (!busy) try { localStorage.setItem(KEY, JSON.stringify(msgs.slice(-60))); } catch { /* quota */ }
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs, busy]);
  useEffect(() => {
    if (pending && !busy) {
      clearPending();
      void send(pending);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const history = [...msgs.filter((m) => !m.error), { role: "user" as const, content: q }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    const update = (fn: (m: Msg) => Msg) => setMsgs((all) => [...all.slice(0, -1), fn(all[all.length - 1])]);
    let full = "";
    try {
      abort.current = new AbortController();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.current.signal,
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })), localNeurons: brain.localNeurons }),
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? `Erreur ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop()!;
        for (const line of lines) {
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.type === "text") {
            full += ev.delta;
            update((m) => ({ ...m, content: full }));
          } else if (ev.type === "neuron") {
            brain.adopt(ev.neuron, ev.persisted);
            update((m) => ({ ...m, saved: [...(m.saved ?? []), ev.neuron.title] }));
          } else if (ev.type === "error") throw new Error(ev.message);
        }
      }
      if (speak && full && "speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(full.replace(/[*#`]|\[([^\]]+)\]\([^)]+\)/g, "$1"));
        u.lang = "fr-FR";
        speechSynthesis.speak(u);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") update((m) => ({ ...m, content: full ? `${full}\n\n${(e as Error).message}` : (e as Error).message, error: true }));
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    if (listening) return rec.current?.stop();
    const W = window as unknown as Record<string, new () => Recognition>;
    const r = new (W.SpeechRecognition ?? W.webkitSpeechRecognition)();
    r.lang = "fr-FR";
    r.interimResults = false;
    r.onresult = (e) => setInput((v) => (v ? v + " " : "") + e.results[0][0].transcript);
    r.onend = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }

  return (
    <div className="view chat-view">
      <header className="view-head row">
        <div className="grow">
          <h1>Jarvis</h1>
          <p className="lede">Claude, avec toute ta base de neurones en contexte.</p>
        </div>
        <button className={`icon-btn ${speak ? "on" : ""}`} onClick={() => { setSpeak(!speak); speechSynthesis?.cancel(); }} aria-pressed={speak} aria-label="Lire les réponses à voix haute"><Icon name="sound" /></button>
        {msgs.length > 0 && <button className="btn ghost" onClick={() => { abort.current?.abort(); setMsgs([]); }}>Effacer</button>}
      </header>

      {!enabled && (
        <div className="notice">
          Le chat intégré a besoin d&apos;une clé API Anthropic (variable <code>ANTHROPIC_API_KEY</code> sur Vercel). En attendant, tu peux
          parler à ta base depuis Claude lui-même grâce au connecteur — voir l&apos;onglet « Lien Claude ».
        </div>
      )}

      <div className="messages" aria-live="polite">
        {msgs.length === 0 && (
          <div className="suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="btn" disabled={!enabled} onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role} ${m.error ? "error" : ""}`}>
            {m.role === "assistant" && !m.content && busy ? <span className="typing" aria-label="Jarvis réfléchit"><i /><i /><i /></span> : <Markdown text={m.content} />}
            {m.saved?.map((t) => (
              <span key={t} className="saved"><Icon name="memory" size={14} /> Mémorisé : {t}</span>
            ))}
          </div>
        ))}
        <div ref={end} />
      </div>

      <form className="composer" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        {canListen && (
          <button type="button" className={`icon-btn ${listening ? "on" : ""}`} onClick={toggleMic} aria-pressed={listening} aria-label="Dicter"><Icon name="mic" /></button>
        )}
        <textarea
          value={input}
          rows={1}
          disabled={!enabled}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
          placeholder={enabled ? "Demande quelque chose à Jarvis…" : "Chat désactivé"}
          aria-label="Message"
        />
        {busy ? (
          <button type="button" className="btn" onClick={() => abort.current?.abort()}>Arrêter</button>
        ) : (
          <button className="btn primary" disabled={!input.trim() || !enabled} aria-label="Envoyer"><Icon name="send" size={16} /></button>
        )}
      </form>
    </div>
  );
}
