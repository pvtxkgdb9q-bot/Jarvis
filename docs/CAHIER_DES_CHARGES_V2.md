# Cahier des charges — Jarvis, version 2

Améliorations de la version 1. 10 novembre 2026.

La version 1 est décrite dans [`CAHIER_DES_CHARGES.md`](CAHIER_DES_CHARGES.md). Ce document ne décrit que ce qui change.

## 1. Constat sur la version 1

La version 1 rassemble et retrouve. Elle a cinq limites qui l'empêchent d'être l'outil du quotidien :

| # | Limite | Conséquence |
|---|---|---|
| L1 | La base fixe est figée : un artefact mal classé ne se corrige que dans un fichier du dépôt. | Le classement, fait d'après les titres, reste approximatif. |
| L2 | Un nouvel artefact ou un nouveau site n'entre dans la base qu'en modifiant le dépôt. | La base vieillit dès le lendemain. |
| L3 | Jarvis ne connaît que les titres. | Impossible de chercher sur le fond (« où ai-je calculé le couple ? »). |
| L4 | Les tâches n'ont ni échéance ni priorité, et rien ne dit quoi faire aujourd'hui. | Jarvis range, il n'aide pas à s'organiser. |
| L5 | Le chat ne sait qu'ajouter une note. Il ne peut ni cocher, ni corriger, ni chercher sur le web. | Il faut repasser par l'interface pour tout. |

## 2. Objectif de la version 2

Faire de Jarvis une base **vivante** (qui se corrige et s'enrichit depuis l'interface et depuis Claude), un **organisateur** (qui dit quoi faire aujourd'hui) et un **assistant qui agit** (qui modifie la base et va chercher l'information).

### Critères de réussite

| Critère | Cible |
|---|---|
| Reclasser un artefact | 3 clics, sans toucher au dépôt |
| Ajouter un nouvel artefact | coller son lien, ou le demander à Claude |
| Savoir quoi faire aujourd'hui | visible dès l'accueil, sans clic |
| Jarvis coche une tâche ou reporte une échéance | en une phrase dans le chat |
| Savoir si un site est en panne | visible sur l'accueil et sur la carte du site |
| Aucune perte de données au passage à la version 2 | mémoire existante reprise automatiquement |

## 3. Exigences fonctionnelles

### A. Base vivante

- **A1 — Annoter et reclasser.** Tout neurone de la base fixe (artefact, site) peut recevoir un projet, une nature, des étiquettes et un résumé différents de ceux d'origine. La modification est enregistrée dans la mémoire, pas dans le dépôt. Un bouton « Rétablir » revient aux valeurs d'origine. Les neurones modifiés sont repérables.
- **A2 — Ajouter un artefact ou un site.** Depuis l'interface ou depuis Claude : un titre et un lien suffisent. Un lien `claude.ai/artifact/…` est reconnu comme artefact. Ces ajouts apparaissent partout comme ceux de la base fixe (bibliothèque, graphe, contexte de Claude) et restent modifiables et supprimables.
- **A3 — Résumés.** Le résumé d'un neurone est pris en compte par la recherche et fourni à Claude. C'est le moyen de rendre un artefact trouvable sur le fond : tu l'écris, ou tu demandes à Claude de le rédiger et de l'enregistrer via le connecteur.
- **A4 — Projets personnalisés.** Créer un projet (nom, description, couleur attribuée automatiquement) et le supprimer. Les 14 projets d'origine ne se suppriment pas.
- **A5 — Page projet.** Chaque projet a sa page : description, compteurs, applications et sites, documents, tâches, notes ; ajout rapide d'une note ou d'une tâche dans le projet ; bouton « En parler à Jarvis » qui ouvre le chat avec le projet en sujet.
- **A6 — Sauvegarde et restauration.** L'export JSON contient toute la mémoire (neurones ajoutés, annotations, projets). L'import fusionne une sauvegarde sans créer de doublon.
- **A7 — Reprise automatique.** Si des neurones étaient gardés dans le navigateur (avant le branchement du stockage), ils sont envoyés au serveur à la première ouverture, puis retirés du navigateur.

### B. Organisation

- **B1 — Échéance et importance.** Une tâche peut avoir une date d'échéance et être marquée importante.
- **B2 — Agenda de l'accueil.** Les tâches à faire sont réparties en : en retard, aujourd'hui, dans les 7 jours, plus tard, sans date. Les tâches importantes passent en tête. Une tâche se coche sur place.
- **B3 — Brief du jour.** Un encadré calculé sans appel à Claude : tâches en retard et du jour, dernier élément modifié, projets sans activité depuis plus de 30 jours, sites hors ligne. Un bouton demande à Jarvis un brief rédigé.
- **B4 — Tri des tâches.** Dans la mémoire, les tâches à faire précèdent les tâches faites, triées par échéance.

### C. Jarvis (chat)

- **C1 — Jarvis agit sur la base.** Outils : `memoriser` (note, tâche, idée, lien, artefact, site, avec échéance), `modifier` (cocher une tâche, changer une échéance, corriger un titre, reclasser ou résumer un artefact), `creer_projet`. Chaque action est signalée dans la conversation et visible aussitôt dans l'interface.
- **C2 — Recherche sur le web.** Jarvis peut chercher sur le web quand la question le demande (au plus 3 recherches par réponse). Si la recherche n'est pas disponible sur le compte, le chat continue sans elle.
- **C3 — Parler d'un projet.** Depuis une page projet, le chat s'ouvre sur une question portant sur ce projet.
- **C4 — Confort.** Copier une réponse ; nouvelle conversation ; indication « recherche en cours ».
- **C5 — Contexte enrichi.** Jarvis reçoit, en plus de la base, la date du jour et la liste des tâches ouvertes avec leurs échéances.

### D. Connecteur Claude (MCP)

- **D1 — Nouveaux outils.** `taches` (tâches ouvertes, classées par échéance) et `creer_projet`.
- **D2 — Outils étendus.** `memoriser` accepte les artefacts, les sites, l'échéance et l'importance. `modifier` s'applique à tous les neurones : sur un neurone de la base fixe, il enregistre une annotation (projet, nature, étiquettes, résumé). `oublier` sur un neurone de la base fixe retire son annotation.
- **D3 — Compatibilité.** Les noms et paramètres de la version 1 continuent de fonctionner : un connecteur déjà ajouté n'a pas à être reconfiguré.
- **D4 — Jeton en en-tête.** Le connecteur accepte aussi le jeton dans l'en-tête `Authorization: Bearer`, sur l'adresse `/api/mcp`, pour les clients qui le permettent (le jeton n'apparaît alors plus dans l'adresse).

### E. Surveillance des sites

- **E1 — État des sites.** Jarvis interroge chaque site de la base et affiche : en ligne, protégé (le site répond mais demande une authentification), hors ligne, avec le temps de réponse. L'état apparaît sur la carte du site, dans une tuile de l'accueil et dans le brief.
- **E2 — Limites.** Seuls les sites de la base sont interrogés (jamais une adresse saisie librement). Résultat gardé 5 minutes. Délai maximal de 6 secondes par site.

### F. Interface

- **F1 — Éditeur unique.** Une seule fenêtre pour créer et modifier tout neurone, accessible depuis chaque carte, la page projet, la mémoire et la palette.
- **F2 — Thème.** Sombre, clair ou automatique (selon le système), mémorisé par navigateur, sans flash au chargement.
- **F3 — Bibliothèque.** Tri par date, titre ou projet ; filtre « modifiés » ; copie du lien d'un neurone.
- **F4 — Graphe.** Filtre par type (artefacts, sites, mémoire) ; bouton « Recentrer » ; zoom par pincement sur écran tactile ; double-clic sur un projet pour ouvrir sa page.
- **F5 — Raccourcis clavier.** `/` ouvre la recherche, `n` crée un neurone, `1` à `6` changent d'écran. Inactifs pendant la saisie.
- **F6 — Installation.** Icône pour l'écran d'accueil d'iOS et d'Android.

### G. Sécurité et robustesse

- **G1 — Tentatives de connexion.** Après 8 échecs en 10 minutes depuis une même adresse, la connexion est refusée pendant 10 minutes.
- **G2 — Format de stockage.** La mémoire passe d'une liste de neurones à un document versionné (neurones, annotations, projets). L'ancien format est lu et converti à la première écriture.
- **G3 — Validation.** Une échéance doit être une date valide ; un artefact ou un site doit avoir un lien `http(s)` ; les annotations ne peuvent pas changer le titre ni le lien d'un neurone de la base fixe.
- **G4 — Tests.** Les règles ci-dessus, les annotations, les projets, l'agenda, le brief, la fusion de sauvegardes et les nouveaux outils MCP sont couverts par des tests automatiques.

## 4. Architecture — ce qui change

```
Mémoire (Vercel Blob privé, ou navigateur à défaut)
┌─────────────────────────────────────────────┐
│ version: 2                                  │
│ neurons:   neurones ajoutés                 │
│ overrides: annotations de la base fixe      │
│ projects:  projets personnalisés            │
└─────────────────────────────────────────────┘
        │  mêmes fonctions pures (lib/brain.ts)
        ├── serveur : API, chat, connecteur MCP
        └── navigateur : mode sans stockage
```

- Les règles (validation, annotation, fusion, agenda, brief) vivent dans des fonctions pures partagées par le serveur et le navigateur : un seul comportement, testé une fois.
- Nouvelles routes : `/api/projects`, `/api/import`, `/api/health`, `/api/mcp` (jeton en en-tête).
- Le chat applique ses actions par la même couche que l'interface et le connecteur.

## 5. Écarté de cette version, et pourquoi

| Idée | Raison |
|---|---|
| Lecture automatique du contenu des artefacts | Aucune API ne le permet. Remplacé par les résumés (A3). |
| Notifications push pour les échéances | Demande un service de notification et une clé dédiée ; le brief et l'agenda couvrent le besoin à l'ouverture. |
| Synchronisation avec un agenda externe | Hors du besoin exprimé ; ajoute une dépendance et des autorisations. |
| Plusieurs conversations archivées | Une conversation courante suffit ; ce qui doit durer va dans la mémoire. |
| Recherche sémantique | Inutile sous quelques centaines de neurones ; la recherche par mots et les résumés suffisent. |

## 6. Recette

| Test | Méthode |
|---|---|
| Annotation d'un artefact, rétablissement, repérage « modifié » | test automatique + navigateur |
| Ajout d'un artefact par lien, refus sans lien | test automatique |
| Échéance invalide refusée ; agenda : retard, jour, semaine | test automatique |
| Brief : contenu selon les tâches et les sites | test automatique |
| Projets : création, doublon refusé, suppression, projet d'origine protégé | test automatique |
| Fusion de sauvegardes sans doublon ; lecture de l'ancien format | test automatique |
| Outils MCP nouveaux et anciens | test automatique |
| Limitation des tentatives de connexion | requêtes |
| Tous les écrans, deux thèmes, bureau et mobile, sans erreur ni débordement | navigateur automatisé |
| Éditeur, page projet, agenda, raccourcis | navigateur automatisé |
