# Jarvis

Assistant personnel et base de neurones reliée à Claude : tous tes artefacts Claude, tes sites Vercel et ta mémoire (notes, tâches, idées) au même endroit, consultables par toi et par Claude.

## Ce que ça fait

- **Accueil** — brief du jour, agenda des tâches (en retard, aujourd'hui, semaine), capture rapide, état des sites, projets.
- **Bibliothèque** — recherche, filtres et tris sur toute la base ; ajout d'un artefact ou d'un site par son lien.
- **Pages projet** — tout ce qui se rattache à un projet ; projets personnalisés.
- **Cerveau** — graphe interactif des neurones et de leurs synapses.
- **Jarvis** — chat avec Claude, toute la base en contexte ; il note, coche, reclasse et cherche sur le web.
- **Mémoire** — notes, tâches avec échéance, idées, liens.
- **Annotations** — tout artefact ou site peut être reclassé et résumé, sans toucher au dépôt.
- **Lien Claude** — connecteur MCP : Claude lit et écrit dans la base depuis n'importe quelle conversation.
- `⌘K` / `Ctrl K` ou `/` — recherche et commandes ; `n` nouveau neurone ; `1`–`6` changer d'écran.
- Thème sombre, clair ou automatique ; installable sur téléphone.

Documents : [cahier des charges v1](docs/CAHIER_DES_CHARGES.md) · [cahier des charges v2](docs/CAHIER_DES_CHARGES_V2.md) · [ce qu'il reste à faire soi-même](docs/A_FAIRE.md).

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
| `JARVIS_WEB_SEARCH` | Facultatif : `off` désactive la recherche web du chat. |

Redéploie après chaque changement de variable.

## Relier Jarvis à Claude

1. Définis `JARVIS_MCP_TOKEN`, redéploie.
2. Ouvre l'onglet **Lien Claude** de Jarvis et copie l'adresse du connecteur (`https://<domaine>/api/mcp/<jeton>`).
3. Dans Claude : **Paramètres → Connecteurs → Ajouter un connecteur personnalisé**, colle l'adresse.

Outils exposés : `rechercher`, `lister_projets`, `vue_d_ensemble`, `taches`, `memoriser`, `modifier`, `oublier`, `creer_projet`.

Les clients qui acceptent un en-tête peuvent utiliser `https://<domaine>/api/mcp` avec `Authorization: Bearer <jeton>`.

## Ajouter un artefact ou un site

- Dans Jarvis : **Bibliothèque → Ajouter**, colle le lien.
- Depuis Claude : « Ajoute cet artefact à Jarvis ».
- Dans le dépôt, pour la base d'origine : [`data/artifacts.json`](data/artifacts.json) et [`data/sites.json`](data/sites.json).

## Limite connue

Claude n'expose pas d'API pour lister ou lire les artefacts d'un compte. Jarvis connaît donc leur titre, leur lien et leur classement, pas leur contenu : c'est le résumé (écrit par toi ou par Claude via le connecteur) qui le rend trouvable sur le fond. Les nouveaux artefacts s'ajoutent par leur lien.

## Structure

```
data/            base fixe (artefacts, projets, sites)
docs/            cahier des charges
src/lib/         logique : brain (règles pures), store, tools, mcp, auth
src/app/api/     routes : neurons, projects, import, health, chat, mcp, auth, status
src/components/  interface
tests/           tests
```
