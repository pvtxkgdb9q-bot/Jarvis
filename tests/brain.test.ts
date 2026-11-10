import assert from "node:assert/strict";
import { test } from "node:test";
import { applyPatch, buildGraph, makeNeuron, normalize, searchNeurons, toContext } from "../src/lib/brain.ts";
import { handleRpc } from "../src/lib/mcp.ts";
import { PROJECTS, SEED_NEURONS } from "../src/lib/seed.ts";

test("la base de départ contient les 44 artefacts, tous rattachés à un projet connu", () => {
  const arts = SEED_NEURONS.filter((n) => n.type === "artifact");
  assert.equal(arts.length, 44);
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
  const n = makeNeuron({ type: "task", title: " Réviser ", url: "javascript:alert(1)", tags: ["A", "a", " b "] }, "claude");
  assert.equal(n.title, "Réviser");
  assert.equal(n.url, undefined);
  assert.deepEqual(n.tags, ["a", "b"]);
  assert.equal(n.done, false);
  assert.equal(n.source, "claude");
  // Un type inconnu (ex. tentative de créer un faux artefact) retombe sur « note ».
  assert.equal(makeNeuron({ type: "artifact" as never, title: "x" }, "user").type, "note");
  assert.equal(applyPatch(n, { done: true, title: "" }).done, true);
  assert.equal(applyPatch(n, { title: "" }).title, "Réviser");
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
  assert.deepEqual(tools.result.tools.map((t: any) => t.name), ["rechercher", "lister_projets", "vue_d_ensemble", "memoriser", "modifier", "oublier"]);
  const found = (await handleRpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "rechercher", arguments: { requete: "baryk", type: "artifact" } } })) as any;
  assert.match(found.result.content[0].text, /Plan de relance/);
  // Sans store Blob, l'écriture échoue proprement (erreur d'outil, pas d'exception).
  const write = (await handleRpc({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "memoriser", arguments: { title: "x" } } })) as any;
  assert.equal(write.result.isError, true);
  const unknown = (await handleRpc({ jsonrpc: "2.0", id: 5, method: "nope" })) as any;
  assert.equal(unknown.error.code, -32601);
});
