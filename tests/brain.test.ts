import assert from "node:assert/strict";
import { test } from "node:test";
import { agenda, applyPatch, applyState, brief, buildGraph, emptyState, isEmptyState, isoDay, makeNeuron, normalize, normalizeState, searchNeurons, stateAddProject, stateMerge, statePatch, stateRemove, stateRemoveProject, toContext } from "../src/lib/brain.ts";
import { handleRpc } from "../src/lib/mcp.ts";
import { PROJECTS, SEED_NEURONS } from "../src/lib/seed.ts";
import { localOps } from "../src/lib/store.ts";

test("la base de départ contient les 44 artefacts, tous rattachés à un projet connu", () => {
  const arts = SEED_NEURONS.filter((n) => n.type === "artifact");
  assert.equal(arts.length, 44);
  assert.equal(SEED_NEURONS.filter((n) => n.type === "site").length, 7);
  assert.equal(new Set(arts.map((n) => n.id)).size, 44);
  for (const n of arts) {
    assert.ok(PROJECTS.some((p) => p.id === n.project), `projet inconnu pour ${n.title}`);
    assert.match(n.url!, /^https:\/\/claude\.ai\/artifact\/[A-Za-z0-9]+$/);
  }
});

test("la recherche ignore les accents, cherche par préfixe et exige tous les mots", () => {
  assert.equal(normalize("Éditeur — Réducteur"), "editeur reducteur");
  const r = searchNeurons(SEED_NEURONS, "reduct", PROJECTS);
  assert.ok(r.length >= 2 && r.every((n) => normalize(n.title + n.tags.join(" ")).includes("reduct")));
  const cdc = searchNeurons(SEED_NEURONS, "cahier orthoptie", PROJECTS);
  assert.deepEqual(cdc.map((n) => n.title), ["Cahier des charges du logiciel d'orthoptie"]);
  assert.equal(searchNeurons(SEED_NEURONS, "zzzz", PROJECTS).length, 0);
  // Un nom de projet suffit à retrouver ses neurones.
  assert.ok(searchNeurons(SEED_NEURONS, "pompiers", PROJECTS).length >= 2);
});

test("makeNeuron valide les entrées et refuse les liens dangereux", () => {
  assert.throws(() => makeNeuron({ title: "  " }, "user"));
  const n = makeNeuron({ type: "task", title: " Réviser ", url: "javascript:alert(1)", tags: ["A", "a", " #b "], due: "2026-11-14", important: true }, "claude");
  assert.equal(n.title, "Réviser");
  assert.equal(n.url, undefined);
  assert.deepEqual(n.tags, ["a", "b"]);
  assert.equal(n.done, false);
  assert.equal(n.due, "2026-11-14");
  assert.equal(n.important, true);
  assert.equal(n.source, "claude");
  assert.equal(makeNeuron({ type: "inconnu" as never, title: "x" }, "user").type, "note");
  assert.equal(applyPatch(n, { done: true, title: "" }).done, true);
  assert.equal(applyPatch(n, { title: "" }).title, "Réviser");
  assert.equal(applyPatch(n, { due: "" }).due, undefined);
});

test("une échéance doit être une date réelle", () => {
  for (const due of ["demain", "2026-13-01", "2026-02-30", "14/11/2026"]) {
    assert.throws(() => makeNeuron({ type: "task", title: "x", due }, "user"), /Échéance invalide/);
  }
  // L'échéance ne concerne que les tâches.
  assert.equal(makeNeuron({ type: "note", title: "x", due: "2026-11-14" }, "user").due, undefined);
});

test("un artefact ou un site exige un lien ; un lien d'artefact Claude est reconnu", () => {
  assert.throws(() => makeNeuron({ type: "artifact", title: "Sans lien" }, "user"), /lien/);
  assert.throws(() => makeNeuron({ type: "site", title: "x", url: "ftp://x" }, "user"), /lien/);
  const a = makeNeuron({ type: "link", title: "Nouveau", url: "https://claude.ai/artifact/abc123", kind: "app" }, "claude");
  assert.equal(a.type, "artifact");
  assert.equal(a.kind, "app");
  assert.equal(makeNeuron({ type: "site", title: "S", url: "https://s.vercel.app" }, "user").kind, "site");
  // Un artefact ne peut pas perdre son lien.
  assert.equal(applyPatch(a, { url: "" }).url, "https://claude.ai/artifact/abc123");
});

test("annoter un neurone de la base fixe : reclassement, résumé, rétablissement", () => {
  const id = SEED_NEURONS[0].id;
  const r = statePatch(emptyState(), SEED_NEURONS, id, { project: "perso", tags: ["Thermique"], content: "Résumé du boîtier", title: "Pirate", url: "https://evil.example" } as never)!;
  const merged = applyState(SEED_NEURONS, r.state);
  const n = merged.find((x) => x.id === id)!;
  assert.equal(n.project, "perso");
  assert.deepEqual(n.tags, ["thermique"]);
  assert.equal(n.edited, true);
  // Le titre et le lien d'origine sont intouchables.
  assert.equal(n.title, SEED_NEURONS[0].title);
  assert.equal(n.url, SEED_NEURONS[0].url);
  assert.equal(merged.length, SEED_NEURONS.length);
  // Le résumé rend l'artefact trouvable sur le fond.
  assert.equal(searchNeurons(merged, "resume boitier", PROJECTS)[0].id, id);
  assert.ok(toContext(merged, PROJECTS).includes("Résumé du boîtier"));
  const back = stateRemove(r.state, id)!;
  assert.deepEqual(applyState(SEED_NEURONS, back), SEED_NEURONS);
  assert.equal(stateRemove(back, id), null);
  assert.equal(statePatch(emptyState(), SEED_NEURONS, "inexistant", { project: "x" }), null);
});

test("projets personnalisés : création, doublon refusé, suppression", () => {
  const r = stateAddProject(emptyState(), { name: "Stage 2027", summary: "Recherche de stage" }, PROJECTS);
  assert.equal(r.project.id, "stage-2027");
  assert.equal(r.project.custom, true);
  assert.ok(!PROJECTS.some((p) => p.hue === r.project.hue));
  assert.throws(() => stateAddProject(r.state, { name: "stage 2027" }, [...PROJECTS, ...r.state.projects]), /existe déjà/);
  assert.throws(() => stateAddProject(emptyState(), { name: "Le BARYK" }, PROJECTS), /existe déjà/);
  assert.throws(() => stateAddProject(emptyState(), { name: " " }, PROJECTS));
  assert.equal(stateRemoveProject(r.state, "stage-2027")!.projects.length, 0);
  // Un projet d'origine n'est pas dans la mémoire : il ne se supprime pas.
  assert.equal(stateRemoveProject(r.state, "baryk"), null);
});

test("agenda : retard, aujourd'hui, semaine, plus tard, sans date ; importantes en tête", () => {
  const t = (title: string, due?: string, extra = {}) => ({ ...makeNeuron({ type: "task", title, due }, "user"), ...extra });
  const list = [t("retard", "2026-11-08"), t("jour", "2026-11-10"), t("jour important", "2026-11-10", { important: true }), t("semaine", "2026-11-17"), t("tard", "2026-11-18"), t("libre"), t("faite", "2026-11-01", { done: true })];
  const a = agenda(list, "2026-11-10");
  assert.deepEqual(a.late.map((n) => n.title), ["retard"]);
  assert.deepEqual(a.today.map((n) => n.title), ["jour important", "jour"]);
  assert.deepEqual(a.week.map((n) => n.title), ["semaine"]);
  assert.deepEqual(a.later.map((n) => n.title), ["tard"]);
  assert.deepEqual(a.undated.map((n) => n.title), ["libre"]);
  const b = brief(list, PROJECTS, "2026-11-10", ["MécaMaster"]);
  assert.match(b[0], /1 tâche en retard/);
  assert.match(b[1], /2 tâches pour aujourd'hui/);
  assert.ok(b.some((l) => l.includes("hors ligne : MécaMaster")));
  assert.match(brief([], PROJECTS, "2026-11-10")[0], /Aucune tâche urgente/);
});

test("sauvegardes : ancien format lu, fusion sans doublon", () => {
  const n1 = makeNeuron({ title: "un" }, "user");
  const n2 = makeNeuron({ title: "deux" }, "user");
  // Version 1 : simple liste de neurones.
  const v1 = normalizeState([n1, { invalide: true }]);
  assert.equal(v1.version, 2);
  assert.deepEqual(v1.neurons, [n1]);
  assert.ok(isEmptyState(normalizeState(null)) && isEmptyState(normalizeState("n'importe quoi")));
  const incoming = { ...emptyState(), neurons: [n1, n2], overrides: { a: { project: "x" } }, projects: [{ id: "baryk", name: "Faux", hue: 0, summary: "" }, { id: "neuf", name: "Neuf", hue: 1, summary: "" }] };
  const merged = stateMerge({ ...v1, overrides: { a: { project: "gardé" } } }, incoming, PROJECTS);
  assert.deepEqual(merged.neurons.map((n) => n.title), ["un", "deux"]);
  assert.equal(merged.overrides.a.project, "gardé");
  assert.deepEqual(merged.projects.map((p) => p.id), ["neuf"]);
  assert.deepEqual(stateMerge(merged, incoming, PROJECTS), merged);
});

test("le graphe relie noyau, projets et neurones sans lien orphelin", () => {
  const { nodes, links } = buildGraph(SEED_NEURONS, PROJECTS);
  const ids = new Set(nodes.map((n) => n.id));
  assert.equal(nodes.filter((n) => n.kind === "neuron").length, SEED_NEURONS.length);
  assert.equal(nodes.filter((n) => n.kind === "project").length, PROJECTS.length);
  for (const l of links) assert.ok(ids.has(l.source) && ids.has(l.target));
  // Des synapses transverses existent (étiquettes partagées entre projets).
  assert.ok(links.some((l) => l.strength < 0.5 && !l.source.startsWith("p:") && l.source !== "core"));
});

test("le contexte envoyé à Claude liste chaque neurone avec son lien", () => {
  const ctx = toContext(SEED_NEURONS, PROJECTS);
  for (const n of SEED_NEURONS) assert.ok(ctx.includes(n.url!));
});

test("le serveur MCP répond au protocole et cherche dans la base", async () => {
  const init = (await handleRpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } })) as any;
  assert.equal(init.result.protocolVersion, "2025-03-26");
  assert.equal(await handleRpc({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
  const tools = (await handleRpc({ jsonrpc: "2.0", id: 2, method: "tools/list" })) as any;
  const names = tools.result.tools.map((t: any) => t.name);
  // Les outils de la version 1 existent toujours ; deux nouveaux s'ajoutent.
  for (const n of ["rechercher", "lister_projets", "vue_d_ensemble", "memoriser", "modifier", "oublier", "taches", "creer_projet"]) assert.ok(names.includes(n), n);
  const found = (await handleRpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "rechercher", arguments: { requete: "baryk", type: "artifact" } } })) as any;
  assert.match(found.result.content[0].text, /Plan de relance/);
  // Sans store Blob, l'écriture échoue proprement (erreur d'outil, pas d'exception).
  const write = (await handleRpc({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "memoriser", arguments: { title: "x" } } })) as any;
  assert.equal(write.result.isError, true);
  const unknown = (await handleRpc({ jsonrpc: "2.0", id: 5, method: "nope" })) as any;
  assert.equal(unknown.error.code, -32601);
});

test("les outils d'action écrivent dans la mémoire avec les mêmes règles", async () => {
  const ops = localOps(null);
  const call = async (name: string, args: object) => ((await handleRpc({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, ops)) as any).result;
  const today = isoDay(new Date());
  assert.match((await call("memoriser", { type: "task", title: "Rendre le dossier", due: today })).content[0].text, /Mémorisé/);
  const id = ops.current().neurons[0].id;
  assert.match((await call("taches", {})).content[0].text, /Aujourd'hui :\n.*Rendre le dossier/);
  await call("modifier", { id, done: true });
  assert.equal(ops.current().neurons[0].done, true);
  assert.equal((await call("taches", {})).content[0].text, "Aucune tâche ouverte.");
  assert.equal((await call("memoriser", { type: "task", title: "x", due: "bientôt" })).isError, true);
  assert.equal((await call("memoriser", { type: "artifact", title: "sans lien" })).isError, true);
  // Annotation d'un artefact de la base fixe par Claude, puis retrait.
  const art = SEED_NEURONS[0].id;
  await call("modifier", { id: art, content: "Résumé écrit par Claude", project: "industrie" });
  assert.equal(ops.current().overrides[art].content, "Résumé écrit par Claude");
  assert.match((await call("rechercher", { requete: "ecrit par claude" })).content[0].text, /1 résultat/);
  assert.equal((await call("oublier", { id: art })).content[0].text, "Supprimé.");
  assert.equal((await call("oublier", { id: art })).isError, true);
  assert.match((await call("creer_projet", { name: "Stage" })).content[0].text, /id: stage/);
  assert.match((await call("lister_projets", {})).content[0].text, /Stage \(id: stage\)/);
  assert.equal((await call("creer_projet", { name: "Stage" })).isError, true);
  assert.ok(ops.changed());
});
