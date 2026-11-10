# Cahier des charges — Jarvis

Assistant personnel et base de neurones reliée à Claude.
Version 1.0 — 10 novembre 2026.

## 1. Contexte et objectif

Tu produis beaucoup avec Claude : 44 artefacts à ce jour (applications, cahiers des charges, fiches de révision, dossiers de SAE, modèles 3D, guides) et plusieurs sites déployés sur Vercel. Ces productions sont dispersées : il faut se souvenir qu'un document existe, puis le retrouver dans une liste plate.

Jarvis répond à trois besoins :

1. **Retrouver** n'importe quelle production en quelques secondes.
2. **Relier** les productions entre elles (un cahier des charges et l'application qui en découle, les pièces d'une même SAE) pour voir l'ensemble.
3. **Donner cette mémoire à Claude**, pour qu'il connaisse tes projets dans chaque conversation et puisse y noter ce que tu lui demandes de retenir.

### Critères de réussite

| Critère | Cible |
|---|---|
| Retrouver un artefact dont on connaît un mot du titre | moins de 5 secondes, depuis n'importe quel écran |
| Tous les artefacts existants présents et classés | 44 sur 44 |
| Claude peut interroger la base depuis claude.ai | oui, sans clé API |
| Utilisable au téléphone | oui, sans défilement horizontal |
| Données privées | aucune page ni API accessible sans authentification |

## 2. Utilisateur et usages

Un seul utilisateur : toi, étudiant en BUT GMP, sur ordinateur et téléphone.

| Situation | Ce que Jarvis doit permettre |
|---|---|
| « Où est mon calculateur de réducteur ? » | `⌘K`, taper « reduc », Entrée : l'artefact s'ouvre |
| Préparer une revue de SAE | voir d'un coup tous les documents du projet |
| Une idée en cours de route | la noter en une ligne depuis l'accueil |
| Discuter d'un projet avec Claude | Claude connaît déjà les documents liés |
| « Retiens que… » dit à Claude | le souvenir apparaît dans Jarvis |
| Un nouveau site déployé | il apparaît dans la bibliothèque |

## 3. Périmètre

### Inclus dans la version 1

- Base de neurones : artefacts Claude, sites Vercel, notes, tâches, idées, liens.
- Cinq écrans : Accueil, Bibliothèque, Cerveau (graphe), Jarvis (chat), Mémoire ; plus l'écran de réglages « Lien Claude ».
- Recherche globale et palette de commandes.
- Connecteur MCP pour Claude (lecture et écriture).
- Chat intégré avec Claude, dictée et lecture vocales.
- Authentification par mot de passe.
- Déploiement Vercel, dépôt GitHub dédié.

### Hors périmètre (assumé)

- **Lecture du contenu des artefacts.** Claude n'expose pas d'API publique pour lister ou lire les artefacts d'un compte : Jarvis connaît leur titre, leur lien, leur date et leur classement, pas leur texte.
- **Synchronisation automatique des nouveaux artefacts.** Même raison. Deux moyens d'en ajouter : demander à Claude (« ajoute cet artefact à Jarvis », via le connecteur) ou compléter `data/artifacts.json`.
- Multi-utilisateur, partage, comptes.
- Agenda, e-mails, domotique.

## 4. Exigences fonctionnelles

### 4.1 Base de neurones

- **F1.** Un neurone porte : identifiant, type, titre, contenu facultatif, lien facultatif, projet, nature, étiquettes, dates de création et de modification, origine (base fixe, Vercel, toi, Claude).
- **F2.** Types : `artifact`, `site` (base fixe, en lecture seule) ; `note`, `task`, `idea`, `link` (mémoire, modifiable).
- **F3.** Les artefacts sont classés en projets (MécaMaster, Le BARYK, SAE 3.1, SAE 3.2, etc.) et par nature (application, site, document, cahier des charges, fiche, guide, modèle 3D, planning).
- **F4.** Les synapses sont déduites, pas saisies : chaque neurone est relié à son projet, et deux neurones de projets différents qui partagent une étiquette sont reliés entre eux.
- **F5.** Un projet peut être un projet connu ou un nom libre.

### 4.2 Accueil

- **F6.** Salutation selon l'heure, date, résumé chiffré de la base.
- **F7.** Capture rapide : une ligne, un type (note, tâche, idée), ajout immédiat ; ou envoi de la même ligne à Jarvis.
- **F8.** Tâches à faire, cochables sur place.
- **F9.** Favoris, éléments récemment modifiés, projets avec leur nombre de neurones (un clic ouvre le projet dans la bibliothèque).

### 4.3 Bibliothèque

- **F10.** Recherche plein texte sur titre, étiquettes, projet, nature et contenu ; insensible aux accents et à la casse ; par préfixe ; tous les mots doivent correspondre ; résultats classés par pertinence puis par date.
- **F11.** Filtres cumulables : type, projet, nature, favoris. Regroupement par projet en option.
- **F12.** Chaque carte ouvre l'élément dans un nouvel onglet et peut être mise en favori.

### 4.4 Cerveau

- **F13.** Graphe interactif : noyau, projets, neurones ; couleurs par projet.
- **F14.** Déplacement, zoom (molette et boutons), glisser un nœud.
- **F15.** Survol ou clic : le nœud et ses voisins s'illuminent, le reste s'estompe ; un panneau donne le détail, les synapses transverses et le lien.
- **F16.** Recherche qui illumine les neurones correspondants.

### 4.5 Jarvis (chat)

- **F17.** Conversation avec Claude ; toute la base est fournie en contexte à chaque échange.
- **F18.** Réponses affichées au fil de l'eau ; arrêt possible.
- **F19.** Outil `memoriser` : quand tu demandes de retenir quelque chose, Jarvis crée le neurone et le signale dans la conversation.
- **F20.** Dictée (micro) et lecture à voix haute des réponses, quand le navigateur les propose.
- **F21.** Historique gardé dans le navigateur, effaçable.

### 4.6 Mémoire

- **F22.** Créer, modifier, supprimer notes, tâches, idées et liens ; cocher une tâche.
- **F23.** Sans stockage serveur configuré, la mémoire reste dans le navigateur et l'application le dit clairement.

### 4.7 Lien avec Claude (connecteur MCP)

- **F24.** Jarvis expose un serveur MCP (transport HTTP) que Claude ajoute comme connecteur personnalisé.
- **F25.** Outils : `rechercher`, `lister_projets`, `vue_d_ensemble` (lecture) ; `memoriser`, `modifier`, `oublier` (écriture, limitée à la mémoire — la base fixe ne peut être ni modifiée ni supprimée).
- **F26.** L'écran « Lien Claude » affiche l'adresse du connecteur, les étapes d'ajout et l'état de chaque branchement.

### 4.8 Transverse

- **F27.** Palette `⌘K` / `Ctrl K` : chercher un neurone, changer d'écran, poser une question à Jarvis, créer une note ou une tâche.
- **F28.** Export de toute la base en JSON.

## 5. Exigences non fonctionnelles

| Domaine | Exigence |
|---|---|
| Sécurité | Tout est derrière un mot de passe (cookie de session `HttpOnly`, signé). Sans mot de passe configuré en production, l'application reste verrouillée. Le connecteur MCP exige un jeton secret d'au moins 16 caractères. Comparaisons à temps constant. Seuls les liens `http(s)` sont acceptés. Aucun HTML injecté dans le rendu des réponses. Pages non indexées. |
| Confidentialité | Aucun service tiers hormis Vercel (hébergement, stockage) et l'API Anthropic (chat). Les secrets ne vivent que dans les variables d'environnement. |
| Performance | Page d'accueil statique ; recherche instantanée côté navigateur ; graphe fluide jusqu'à plusieurs centaines de neurones. |
| Accessibilité | Navigation au clavier, focus visible, libellés ARIA, respect de `prefers-reduced-motion`, contrastes lisibles. |
| Mobile | Barre d'onglets en bas, aucune page ne déborde horizontalement à 390 px. |
| Robustesse | Chaque intégration est facultative : sans clé API le chat se désactive, sans stockage la mémoire reste locale, sans jeton Vercel la liste des sites vient du dépôt. |
| Maintenabilité | TypeScript strict, logique métier pure et testée, aucune dépendance d'interface. |

## 6. Architecture

```
Navigateur (React)                      Claude (claude.ai, Claude Code)
   │  cookie de session                          │  jeton secret
   ▼                                             ▼
┌──────────────────────── Next.js sur Vercel ────────────────────────┐
│ proxy.ts : contrôle d'accès                                        │
│ /api/neurons   lecture / écriture         /api/mcp/<jeton>  MCP    │
│ /api/chat      Claude en flux + outil     /api/status              │
│                                                                    │
│ lib/brain.ts   recherche, graphe, validation, contexte (pur)       │
│ lib/store.ts   base fixe + mémoire                                 │
└───────┬───────────────────┬───────────────────────┬────────────────┘
        ▼                   ▼                       ▼
  data/*.json         Vercel Blob (privé)     API Anthropic
  (base fixe)         (mémoire)               (chat)
```

- **Pile :** Next.js 16 (App Router), React 19, TypeScript, CSS écrit à la main, SDK Anthropic, Vercel Blob.
- **Base fixe :** `data/artifacts.json`, `data/projects.json`, `data/sites.json`, versionnés dans le dépôt. Avec `VERCEL_TOKEN`, la liste des sites est lue en direct sur l'API Vercel.
- **Mémoire :** un fichier JSON unique dans un store Vercel Blob privé. Un seul utilisateur, quelques centaines d'entrées au plus : une base de données serait superflue.
- **Lien Claude :** deux voies complémentaires. Le connecteur MCP amène la base dans Claude (avec ton abonnement). Le chat intégré amène Claude dans Jarvis (avec une clé API).
- **Modèle du chat :** `claude-opus-5-5` par défaut, modifiable par `JARVIS_MODEL`.

## 7. Variables d'environnement

| Variable | Rôle | Obligatoire |
|---|---|---|
| `JARVIS_PASSWORD` | mot de passe d'accès | oui |
| `JARVIS_MCP_TOKEN` | jeton du connecteur Claude | pour le connecteur |
| `ANTHROPIC_API_KEY` | chat intégré | pour le chat |
| `BLOB_READ_WRITE_TOKEN` | mémoire persistante | pour la mémoire partagée |
| `VERCEL_TOKEN`, `VERCEL_TEAM_ID` | sites en direct | non |
| `JARVIS_MODEL` | modèle du chat | non |

## 8. Recette

| Test | Méthode |
|---|---|
| 44 artefacts présents, identifiants uniques, projet connu | test automatique |
| Recherche : accents, préfixe, tous les mots, nom de projet | test automatique |
| Validation des entrées, refus des liens `javascript:` | test automatique |
| Graphe sans lien orphelin, synapses transverses | test automatique |
| Protocole MCP : initialisation, liste d'outils, recherche, erreurs | test automatique |
| Accès refusé sans session, avec cookie forgé, avec mauvais jeton MCP | test manuel par requêtes |
| Les six écrans s'affichent sans erreur, bureau et mobile | navigateur automatisé |
| Capture rapide, recherche, palette | navigateur automatisé |

## 9. Évolutions envisagées

1. Résumé de chaque artefact (rédigé par Claude via le connecteur) pour une recherche sur le fond.
2. Reclassement d'un artefact (projet, étiquettes) depuis l'interface.
3. Échéances et rappels sur les tâches.
4. Brief du matin généré par Jarvis.
5. Recherche sémantique quand la base dépassera quelques centaines de neurones.
