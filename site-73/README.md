# Site-73 · site web du RP SCP

Site du RP SCP « Site-73 » : 14 pages, connexion avec Discord, habilitations attribuées par le staff et espace d'administration. Hébergement sur **Cloudflare Workers** (offre gratuite) : les pages sont servies comme fichiers statiques, et un petit Worker gère la connexion Discord et l'espace staff.

## Comment marchent les habilitations
- **Visiteur non connecté** : niveau 0. Tous les passages classifiés sont masqués.
- **Membre** : il se connecte avec son compte Discord. Le site vérifie qu'il est membre de ton serveur et lit ses rôles. Son habilitation vient, dans cet ordre :
  1. du réglage fait par un admin dans la console staff ;
  2. sinon, de ses rôles Discord (variable `HABILITATION_ROLES`) ;
  3. sinon, du niveau par défaut (`HABILITATION_PAR_DEFAUT`, 1 si rien n'est indiqué).
- **Administrateur** : rôle Discord listé dans `ADMIN_ROLES`, ou identifiant listé dans `ADMIN_IDS`. Il lit tout (niveau 5) et peut activer le **mode staff**.

La protection est réelle : le serveur n'envoie à chaque navigateur que les passages autorisés par son habilitation. Un membre ne peut pas lire un passage de niveau supérieur, même en fouillant le code de la page.

## Le mode staff
Le site public est en **lecture seule** : visiteurs et membres ne peuvent changer ni le niveau d'alerte, ni leur habilitation, ni rien d'autre.

Le staff passe par un mode à part :
1. **Sas d'accès** (`staff.html`, lien « Accès staff » en bas de chaque page) : l'identité est vérifiée avant d'entrer.
2. **Mode staff activé** : un bandeau jaune apparaît en haut de chaque page, avec un cadre autour de l'écran. Il permet de changer l'alerte officielle (après confirmation) et de voir le site comme un membre de niveau 0 à 5.
3. **Console staff** à onglets :
   - tableau de bord (alerte, raccourcis, prochains événements, dernières actions) ;
   - niveau d'alerte de tout le site ;
   - habilitation de chaque membre ;
   - communiqués, avec un niveau de visibilité ;
   - événements ;
   - journal des actions du staff.
4. **Quitter le mode staff** fait disparaître toutes les commandes.

Qui peut entrer :
- **En ligne (Cloudflare + Discord)** : seuls les comptes administrateurs Discord. Le serveur vérifie la session à chaque action : même en trafiquant la page, un membre ne peut rien modifier.
- **Sans serveur**, personne : il n'y a pas de mode démonstration. La console staff affiche « Serveur indisponible » tant que le Worker ne tourne pas (voir la mise en ligne ci-dessous).

## Mise en ligne sur Cloudflare (une seule fois)

### 1. Créer l'application Discord
1. Va sur <https://discord.com/developers/applications>, puis **New Application** (nom : « Site-73 »).
2. Dans **OAuth2**, copie le **Client ID** et le **Client Secret** (bouton *Reset Secret*).
3. L'adresse de retour (**OAuth2 → Redirects**) s'ajoute à l'étape 4, une fois l'adresse du site connue.

Aucun bot n'est nécessaire.

### 2. Récupérer les identifiants Discord
Dans Discord : **Paramètres → Avancés → Mode développeur**. Ensuite :
- clic droit sur ton serveur → **Copier l'identifiant du serveur** ;
- **Paramètres du serveur → Rôles**, clic droit sur un rôle → **Copier l'identifiant du rôle** ;
- clic droit sur un membre → **Copier l'identifiant de l'utilisateur**.

### 3. Créer le Worker sur Cloudflare
1. Crée un compte gratuit sur <https://dash.cloudflare.com>.
2. **Workers & Pages → Create application → Import a repository**. Connecte ton compte GitHub et choisis ce dépôt.
3. Réglages du projet :
   - **Project name** : `site-73`. Ce nom doit être identique au champ `name` de `wrangler.jsonc`, sinon le déploiement échoue.
   - **Root directory** (dans *Advanced settings*) : `site-73`.
   - **Build command** : `npm run build`.
   - **Deploy command** : `npx wrangler deploy` (valeur proposée par défaut).
4. **Deploy**. Au premier déploiement, Cloudflare crée tout seul l'espace de stockage KV `SITE73` qui garde les membres, l'alerte, les communiqués, les événements et le journal.
5. L'adresse du site s'affiche, par exemple `https://site-73.ton-compte.workers.dev`.

Le reste (fichiers publiés, Worker, stockage) est lu dans `site-73/wrangler.jsonc`. À chaque envoi sur la branche de production (`main` par défaut), Cloudflare redéploie le site.

#### Sans GitHub ni terminal : le Worker en un seul fichier
`npm run worker-unique` fabrique `dist/worker.js` : le serveur **et** toutes les pages dans un seul fichier, sans `import`, à coller dans l'éditeur en ligne de Cloudflare. (Coller `serveur/worker.mjs` seul donne 8 erreurs : il a besoin des autres fichiers du dossier `serveur/`.) Ce fichier contient le texte classifié : ne le publie jamais.

1. **Supprime l'ancien Worker** envoyé en glisser-déposer : **Workers & Pages → site-73 → Settings → Delete**. Sinon, ses anciens fichiers passent avant le code et le site reste bloqué.
2. **Workers & Pages → Create → Worker → Start with Hello World!** Nom : `site-73` (l'adresse reste `https://site-73.<ton-compte>.workers.dev`), puis **Deploy**.
3. **Edit code** : dans `worker.js`, sélectionne tout (Ctrl + A), efface, colle **tout** le fichier `dist/worker.js`, puis **Deploy**.
4. **Settings → Bindings → Add → KV namespace** : nom de variable `SITE73`, crée un espace nommé `site-73`, puis **Add binding**.
5. **Settings → Variables and Secrets** : ajoute les variables de la liste ci-dessous (`DISCORD_CLIENT_SECRET` et `SESSION_SECRET` en type *Secret*).
6. Vérifie `https://site-73.<ton-compte>.workers.dev/api/etat` : tout doit être « ok ».

À chaque modification du site, régénère `dist/worker.js` et recolle-le (étape 3) : la liaison KV et les variables restent en place.

### 4. Variables et secrets
1. Dans Cloudflare : **Workers & Pages → site-73 → Settings → Variables and Secrets → Add**. Choisis le type **Secret** pour `DISCORD_CLIENT_SECRET` et `SESSION_SECRET` (et, si tu veux, pour toutes les autres).

| Variable | Valeur |
|---|---|
| `DISCORD_CLIENT_ID` | Client ID de l'application |
| `DISCORD_CLIENT_SECRET` | Client Secret de l'application |
| `DISCORD_GUILD_ID` | identifiant de ton serveur |
| `SESSION_SECRET` | longue chaîne aléatoire, au moins 32 caractères |
| `ADMIN_ROLES` | identifiants des rôles admin, séparés par des virgules |
| `ADMIN_IDS` | *(facultatif)* identifiants d'utilisateurs admin |
| `HABILITATION_ROLES` | *(facultatif)* `idRole:niveau`, ex. `123:2,456:3` |
| `HABILITATION_PAR_DEFAUT` | *(facultatif)* niveau des membres sans rôle, 1 par défaut |
| `SITE_URL` | *(facultatif)* adresse du site si tu utilises ton propre nom de domaine |

2. Dans Discord (**OAuth2 → Redirects**), ajoute `https://site-73.ton-compte.workers.dev/api/auth/callback`, avec l'adresse réelle de l'étape 3.

Les variables s'appliquent tout de suite, et `wrangler.jsonc` (`"keep_vars": true`) les conserve à chaque déploiement.

**Si le stockage n'a pas été créé tout seul** (erreur « KV namespace » au déploiement) : **Storage & Databases → KV → Create**, nom `site-73`. Copie son identifiant, puis dans `wrangler.jsonc` remplace `{ "binding": "SITE73" }` par `{ "binding": "SITE73", "id": "<identifiant>" }`.

### Limites de l'offre gratuite
Les pages et fichiers statiques sont illimités. Chaque page ouverte appelle une fois le Worker (100 000 appels par jour), qui fait deux lectures KV (100 000 par jour). Chaque connexion Discord et chaque action du staff font une ou deux écritures (1 000 par jour). C'est largement assez pour un serveur de RP.

Une modification du staff peut mettre jusqu'à une minute pour être vue partout dans le monde : c'est le délai de propagation de KV.

### Essayer en local (facultatif)
Il faut [Node.js](https://nodejs.org) **22 ou plus** (vérifie avec `node -v`). Dans le terminal de VS Code, depuis le dossier `site-73` :
```
npm install
cp .dev.vars.exemple .dev.vars
npm run dev
```
Remplis `.dev.vars` (il n'est jamais envoyé sur GitHub), puis ouvre <http://localhost:8787>. Pour te connecter en local, ajoute aussi `http://localhost:8787/api/auth/callback` dans les Redirects Discord.

### Important
- **Garde le dépôt GitHub privé** : `contenu/donnees.mjs` contient tout le texte classifié.
- **Retirer un admin** : il perd l'accès à sa prochaine connexion, au plus tard 3 jours après. Pour couper tout de suite, change `SESSION_SECRET` : tout le monde devra se reconnecter.
- Seul le dossier `public/` est publié. Le contenu classifié, le code du serveur et la configuration restent sur le serveur de Cloudflare.
- Le fichier `_redirects` à la racine du dépôt empêche le site Complexe 25 (hébergé ailleurs, il publie tout le dépôt) de servir les fichiers privés du Site-73.

## Modifier le contenu
Tout le texte est dans **`contenu/donnees.mjs`** : dossiers SCP, zones du plan, départements, règlement, protocoles, quiz, distinctions, FAQ. Le lien Discord se met dans `config.discord`.

Au déploiement, `npm run build` génère `public/assets/js/data.js`, où les passages classifiés sont remplacés par des « ▒ ». Si tu modifies le contenu et veux l'essayer en local, lance `npm run build`.

Caviardage : `[[3|texte]]` n'est lisible qu'à partir de l'habilitation 3. `[DONNÉES SUPPRIMÉES]` reste toujours masqué.

Les communiqués, les événements et le niveau d'alerte se gèrent aussi depuis la console staff, sans toucher au code.

## Photo des cartes d'identité
Sur la page Rejoindre, chaque joueur peut indiquer son **pseudo Roblox** : la carte d'identité (et celle de Mon carnet) affiche alors le buste de son avatar Roblox. Le Worker va chercher l'image chez Roblox (route `/api/roblox`), rien à configurer.

Sans pseudo Roblox, ou si le pseudo est introuvable, la carte prend la **photo de profil Discord** du membre connecté. Sinon, elle garde la silhouette. Sans serveur, seule la silhouette s'affiche.

## Sans serveur
Le site n'a **pas de mode démonstration**. Ouvert sans son Worker (fichier local, Live Server, glisser-déposer sur Cloudflare), il reste lisible en visiteur (niveau 0), sans connexion ni espace staff. Le bouton « Hab. » affiche alors **« Serveur indisponible »** avec la raison et un bouton « Réessayer ».

Pour tout avoir en local : `npm run dev`. En ligne : `npm run deploy` ou l'import GitHub, jamais le glisser-déposer.

## Structure
```
site-73/
  wrangler.jsonc, package.json  configuration Cloudflare
  .dev.vars.exemple             liste des variables et secrets
  contenu/donnees.mjs           contenu complet (privé)
  scripts/build.mjs             génère la version publique caviardée
  scripts/worker-unique.mjs     génère dist/worker.js (Worker en un seul fichier)
  serveur/worker.mjs            Worker : aiguille les routes /api/…
  serveur/unique.mjs            entrée du Worker en un seul fichier (pages intégrées)
  serveur/routes/               connexion Discord, contenu, espace staff, photo Roblox
  functions/api/                même code pour Cloudflare Pages
  serveur/commun.mjs            session signée, stockage KV, fusion du contenu
  serveur/caviardage.mjs        masque les passages selon l'habilitation
  public/                       le site publié (14 pages)
```

## Pages
Accueil, Dossiers SCP, Plan, Personnel, Protocoles, Événements, Archives, Règlement, Rejoindre, Laboratoire, Entraînement, Terminal, Mon carnet, Staff.

Contenus inspirés de la Fondation SCP (scp-wiki.wikidot.com), sous licence CC BY-SA 3.0.
