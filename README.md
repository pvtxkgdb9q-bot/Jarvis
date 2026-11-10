# Jarvis

Assistant personnel et base de neurones reliée à Claude : tous tes artefacts Claude, tes sites Vercel et ta mémoire (notes, tâches, idées) au même endroit, consultables par toi et par Claude.

Le cahier des charges complet est dans [`docs/CAHIER_DES_CHARGES.md`](docs/CAHIER_DES_CHARGES.md).

## Ce que ça fait

- **Accueil** — capture rapide, tâches à faire, favoris, récents, projets.
- **Bibliothèque** — recherche et filtres sur toute la base.
- **Cerveau** — graphe interactif des neurones et de leurs synapses.
- **Jarvis** — chat avec Claude, toute la base en contexte ; il peut mémoriser ce que tu lui demandes.
- **Mémoire** — notes, tâches, idées, liens.
- **Lien Claude** — connecteur MCP : Claude lit et écrit dans la base depuis n'importe quelle conversation.
- `⌘K` / `Ctrl K` — recherche et commandes depuis partout.

## Démarrer en local

```bash
npm install
cp .env.example .env.local   # facultatif : sans mot de passe, l'accès est ouvert en développement
npm run dev
```

```bash
npm test          # tests de la logique et du serveur MCP
npm run build     # build de production
```

## Configuration (Vercel → Settings → Environment Variables)

| Variable | Rôle |
|---|---|
| `JARVIS_PASSWORD` | Mot de passe d'accès. **Obligatoire** : sans lui l'application reste verrouillée en production. |
| `JARVIS_MCP_TOKEN` | Jeton secret du connecteur Claude (16 caractères minimum). |
| `ANTHROPIC_API_KEY` | Active le chat intégré. |
| `BLOB_READ_WRITE_TOKEN` | Mémoire persistante. Ajouté automatiquement en connectant un store **Blob privé** au projet. |
| `VERCEL_TOKEN`, `VERCEL_TEAM_ID` | Facultatif : liste les projets Vercel en direct. |
| `JARVIS_MODEL` | Facultatif : modèle du chat (défaut `claude-opus-5-5`). |

Redéploie après chaque changement de variable.

## Relier Jarvis à Claude

1. Définis `JARVIS_MCP_TOKEN`, redéploie.
2. Ouvre l'onglet **Lien Claude** de Jarvis et copie l'adresse du connecteur (`https://<domaine>/api/mcp/<jeton>`).
3. Dans Claude : **Paramètres → Connecteurs → Ajouter un connecteur personnalisé**, colle l'adresse.

Outils exposés : `rechercher`, `lister_projets`, `vue_d_ensemble`, `memoriser`, `modifier`, `oublier`.

## Ajouter un artefact ou un site

- **Artefact** : ajoute une entrée à [`data/artifacts.json`](data/artifacts.json) (`id` = fin de l'URL `claude.ai/artifact/<id>`), ou demande à Claude de l'enregistrer comme lien via le connecteur.
- **Site Vercel** : ajoute une entrée à [`data/sites.json`](data/sites.json), ou définis `VERCEL_TOKEN` pour une liste en direct.

```json
{ "id": "mon-site", "name": "Mon site", "url": "https://mon-site.vercel.app", "project": "perso", "framework": "nextjs", "updated": "2026-11-10T00:00:00.000Z" }
```

## Limite connue

Claude n'expose pas d'API pour lister ou lire les artefacts d'un compte. Jarvis connaît donc leur titre, leur lien et leur classement, pas leur contenu, et les nouveaux artefacts ne s'ajoutent pas tout seuls.

## Structure

```
data/            base fixe (artefacts, projets, sites)
docs/            cahier des charges
src/lib/         logique : brain (recherche, graphe), store, mcp, auth
src/app/api/     routes : neurons, chat, mcp, auth, status
src/components/  interface
tests/           tests
```
