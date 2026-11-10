# Ce qu'il te reste à faire toi-même

Tout ce qui suit demande ton compte, tes secrets ou ton jugement : je ne peux pas le faire à ta place. Classé par ordre d'importance. Les secrets (mot de passe, jeton du connecteur) ne figurent pas ici : ils t'ont été donnés dans la conversation.

Les variables d'environnement se règlent toutes au même endroit : **Vercel → projet `jarvis` → Settings → Environment Variables**. Après chaque changement, redéploie : **Deployments → dernier déploiement → ⋯ → Redeploy**.

---

## 1. À faire en premier

### 1.1 Passer le dépôt GitHub en privé — 1 minute

**Pourquoi.** Le dépôt est public. Il contient les titres de tes 44 artefacts et les adresses de tes 7 sites.

**Comment.** GitHub → dépôt `Jarvis` → **Settings** → tout en bas, **Danger Zone** → **Change repository visibility** → **Make private**.

Le déploiement Vercel continue de fonctionner.

### 1.2 Vérifier que Jarvis fonctionne — 3 minutes

Je n'ai pas pu ouvrir le site en production depuis mon environnement. À contrôler toi-même :

- [ ] La connexion avec le mot de passe fonctionne.
- [ ] Une note ajoutée depuis l'accueil apparaît dans la Mémoire, **et toujours après avoir rechargé la page** (c'est la preuve que le stockage fonctionne).
- [ ] L'onglet « Lien Claude » affiche « Actif » pour le connecteur et pour la mémoire persistante.
- [ ] Sur l'accueil, la tuile des sites indique combien sont joignables.

Si un point échoue, dis-le-moi avec le message affiché.

### 1.3 Changer le mot de passe — 2 minutes

**Pourquoi.** Le mot de passe actuel est apparu en clair dans notre conversation.

**Comment.** Variable `JARVIS_PASSWORD` → nouvelle valeur → redéployer. Toutes les sessions ouvertes sont déconnectées.

Tu peux faire de même pour `JARVIS_MCP_TOKEN` (au moins 16 caractères, idéalement 40 aléatoires). Dans ce cas, l'adresse du connecteur change : il faudra la remettre dans Claude (étape 2.1).

---

## 2. Pour relier Claude

### 2.1 Ajouter le connecteur dans Claude — 2 minutes

**Pourquoi.** C'est ce qui relie ta base à ton Claude : dans n'importe quelle conversation, Claude peut chercher dans tes projets, noter, cocher une tâche, enregistrer un nouvel artefact. Aucune clé API, c'est ton abonnement Claude.

**Comment.**

1. Dans Jarvis, onglet **Lien Claude** → **Copier** l'adresse du connecteur.
2. Dans Claude : **Paramètres → Connecteurs → Ajouter un connecteur personnalisé**.
3. Nom : `Jarvis`. Adresse : celle que tu viens de copier.
4. Dans une conversation, active le connecteur et essaie : « Cherche dans Jarvis ce que j'ai sur la SAE 3.1 ».

**Si Claude n'arrive pas à se connecter.** Vercel protège peut-être l'accès au site. Vercel → projet `jarvis` → **Settings → Deployment Protection** → vérifie que **Vercel Authentication** ne s'applique pas à la production (« Standard Protection » convient).

### 2.2 Activer le chat intégré — 5 minutes, payant à l'usage

**Pourquoi.** L'onglet « Jarvis » est désactivé sans clé API. Le connecteur (2.1) fonctionne sans.

**Comment.**

1. [console.anthropic.com](https://console.anthropic.com) → **API Keys** → créer une clé. Il faut du crédit sur le compte.
2. Sur Vercel, ajouter la variable `ANTHROPIC_API_KEY` avec cette clé → redéployer.

**À savoir.**

- Chaque message est facturé sur ton compte API, indépendamment de ton abonnement Claude. Fixe un plafond de dépense dans la console.
- Le modèle par défaut est `claude-opus-5-5`. Pour réduire le coût, ajoute la variable `JARVIS_MODEL` avec `claude-sonnet-5-5` ou `claude-haiku-5-5`.
- Jarvis peut chercher sur le web. Si la recherche n'est pas disponible sur ton compte, le chat fonctionne sans. Pour la couper : variable `JARVIS_WEB_SEARCH` = `off`.
- Je n'ai pas pu tester le chat avec la vraie API (pas de clé dans mon environnement). Si une erreur s'affiche au premier message, envoie-la-moi.

---

## 3. Pour que la base soit juste et utile

### 3.1 Corriger le classement — 10 minutes

J'ai classé tes artefacts et tes sites d'après leurs titres uniquement. Ce sont des suppositions pour, entre autres :

| Élément | Classé dans | À vérifier |
|---|---|---|
| Revue de projet intermédiaire | SAE 3.2 | peut-être SAE 3.1 |
| Chaîne MDF d'Ussel | Industrie & méthodes | |
| Jumeau numérique d'atelier (FlexSim) | Industrie & méthodes | peut-être une SAE |
| RDM GMP | Révisions & cours | |
| Passeport GMP (site) | Révisions & cours | |
| Simulateur d'amblyopie (site) | Orthoptie | |
| Frigo Festin (site) | Perso & divers | |
| Audit 360, Explorateur Tour 2026, Design System | Industrie / Perso | |

**Comment.** Sur n'importe quelle carte, le crayon ouvre la fenêtre « Annoter » : change le projet, la nature, les étiquettes. Pour un projet qui manque : accueil → **Nouveau projet**.

Plusieurs artefacts portent le même titre (deux « MécaMaster », deux « Le BARYK », deux « Le Cocon de Bois ») : ce sont sans doute des versions successives. Donne-leur un résumé ou une étiquette pour les distinguer.

### 3.2 Faire résumer tes artefacts par Claude — le plus rentable

**Pourquoi.** Jarvis ne connaît que les titres : Claude n'offre aucun moyen de lire automatiquement le contenu d'un artefact. Avec un résumé, un artefact devient trouvable sur le fond, et Jarvis peut en parler.

**Comment.** Une fois le connecteur ajouté (2.1), ouvre un artefact dans Claude et écris :

> Résume cet artefact en 4 ou 5 phrases (à quoi il sert, ce qu'il contient, les chiffres ou choix importants), puis enregistre ce résumé dans Jarvis sur le neurone correspondant.

Commence par ceux que tu rouvres le plus souvent.

### 3.3 Prendre l'habitude pour les nouveaux artefacts

Un nouvel artefact n'entre pas tout seul dans Jarvis. Deux moyens, au choix :

- À la fin de la conversation où tu l'as créé : « Ajoute cet artefact à Jarvis, dans le projet … ».
- Dans Jarvis : **Bibliothèque → Ajouter**, colle le lien.

### 3.4 Sites Vercel en direct — facultatif, 5 minutes

**Pourquoi.** Aujourd'hui la liste de tes sites est figée dans le dépôt. Avec un jeton, chaque nouveau projet Vercel apparaît tout seul.

**Comment.**

1. [vercel.com/account/tokens](https://vercel.com/account/tokens) → créer un jeton.
2. Variables `VERCEL_TOKEN` (le jeton) et `VERCEL_TEAM_ID` (Vercel → Settings de l'équipe → General → Team ID) → redéployer.

Sans cela, un nouveau site s'ajoute comme un artefact (3.3).

---

## 4. Confort

### 4.1 Installer Jarvis sur ton téléphone — 1 minute

- **iPhone** : ouvre Jarvis dans Safari → bouton Partager → **Sur l'écran d'accueil**.
- **Android** : Chrome → menu ⋮ → **Installer l'application**.

### 4.2 Faire une sauvegarde de temps en temps

Onglet **Lien Claude → Exporter une sauvegarde**. Le fichier contient ta mémoire (neurones ajoutés, annotations, projets). **Restaurer une sauvegarde** la refusionne sans doublon.

### 4.3 Une adresse plus simple — facultatif

L'adresse actuelle est générée par Vercel. Vercel → projet `jarvis` → **Settings → Domains** permet de choisir un autre sous-domaine `.vercel.app` gratuit, ou d'attacher un nom de domaine. L'adresse du connecteur change alors : remets-la dans Claude.

### 4.4 Fusionner la branche — facultatif

Tout le code est sur la branche `claude/jarvis-personal-neural-base-dmw3er`, qui sert de branche de production. Si tu préfères une branche `main` classique, dis-le-moi : je la crée et je règle Vercel dessus.

---

## 5. Limites à connaître

- **Tentatives de connexion.** 8 échecs en 10 minutes bloquent une adresse pendant 10 minutes. Le compteur vit dans la mémoire du serveur et repart de zéro quand Vercel relance une instance : c'est un frein, pas une protection absolue. D'où l'importance d'un mot de passe long.
- **Écritures simultanées.** La mémoire est un seul fichier. Si toi et Claude écrivez à la même seconde, la dernière écriture l'emporte. Pour un seul utilisateur, le risque est faible.
- **État des sites.** Un site protégé par mot de passe est affiché « Protégé », pas « Hors ligne ». L'état est gardé 5 minutes.
- **Échéances.** Jarvis ne t'envoie pas de notification : les tâches en retard apparaissent à l'ouverture, dans le brief et l'agenda.
