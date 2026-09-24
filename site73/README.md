# Site-73 · site web du RP SCP

Site du RP SCP « Site-73 » : 14 pages, connexion avec Discord, habilitations attribuées par le staff et espace d'administration. Hébergement prévu sur **Netlify** (fichiers statiques et fonctions serveur).

## Comment marchent les habilitations
- **Visiteur non connecté** : niveau 0. Tous les passages classifiés sont masqués.
- **Membre** : il se connecte avec son compte Discord. Le site vérifie qu'il est membre de ton serveur et lit ses rôles. Son habilitation vient, dans cet ordre :
  1. du réglage fait par un admin dans l'espace staff ;
  2. sinon, de ses rôles Discord (variable `HABILITATION_ROLES`) ;
  3. sinon, du niveau par défaut (`HABILITATION_PAR_DEFAUT`, 1 si rien n'est indiqué).
- **Administrateur** : rôle Discord listé dans `ADMIN_ROLES`, ou identifiant listé dans `ADMIN_IDS`. Il lit tout (niveau 5) et accède à l'**espace staff** (`staff.html`) :
  - régler l'habilitation de chaque membre ;
  - changer le niveau d'alerte de tout le site ;
  - publier ou supprimer des communiqués, avec un niveau de visibilité ;
  - ajouter, modifier ou supprimer des événements ;
  - consulter le journal des actions du staff.

La protection est réelle : le serveur n'envoie à chaque navigateur que les passages autorisés par son habilitation. Un membre ne peut pas lire un passage de niveau supérieur, même en fouillant le code de la page.

## Mise en ligne (une seule fois)

### 1. Créer l'application Discord
1. Va sur <https://discord.com/developers/applications>, puis **New Application** (nom : « Site-73 »).
2. Dans **OAuth2**, copie le **Client ID** et le **Client Secret** (bouton *Reset Secret*).
3. Toujours dans **OAuth2 → Redirects**, ajoute `https://TON-SITE.netlify.app/api/auth/callback` (remplace par l'adresse réelle de ton site Netlify).

Aucun bot n'est nécessaire.

### 2. Récupérer les identifiants Discord
Dans Discord : **Paramètres → Avancés → Mode développeur**. Ensuite :
- clic droit sur ton serveur → **Copier l'identifiant du serveur** ;
- **Paramètres du serveur → Rôles**, clic droit sur un rôle → **Copier l'identifiant du rôle** ;
- clic droit sur un membre → **Copier l'identifiant de l'utilisateur**.

### 3. Créer le site sur Netlify
1. **Add new site → Import an existing project**, puis choisis ce dépôt GitHub.
2. **Base directory** : `site73`. Le reste (build, dossier publié, fonctions) est lu dans `site73/netlify.toml`.
3. Dans **Site configuration → Environment variables**, ajoute :

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

4. Redéploie le site (**Deploys → Trigger deploy**).

Les membres, l'alerte, les communiqués et les événements du staff sont stockés dans **Netlify Blobs**, inclus dans Netlify, sans configuration.

### Important
- **Garde le dépôt GitHub privé** : `contenu/donnees.mjs` contient tout le texte classifié.
- **Retirer un admin** : il perd l'accès à sa prochaine connexion, au plus tard 3 jours après. Pour couper tout de suite, change `SESSION_SECRET` : tout le monde devra se reconnecter.
- Le fichier `_redirects` à la racine du dépôt empêche le site Complexe 25 (qui publie tout le dépôt) de servir les fichiers privés du Site-73.

## Modifier le contenu
Tout le texte est dans **`contenu/donnees.mjs`** : dossiers SCP, zones du plan, départements, règlement, protocoles, quiz, distinctions, FAQ. Le lien Discord se met dans `config.discord`.

Au déploiement, `npm run build` génère `public/assets/js/data.js`, où les passages classifiés sont remplacés par des « ▒ ». Si tu modifies le contenu et veux l'essayer en local, lance `npm run build`.

Caviardage : `[[3|texte]]` n'est lisible qu'à partir de l'habilitation 3. `[DONNÉES SUPPRIMÉES]` reste toujours masqué.

Les communiqués, les événements et le niveau d'alerte se gèrent aussi depuis l'espace staff, sans toucher au code.

## Mode démonstration
Ouvert sans serveur (fichier local, aperçu claude.ai, ancien hébergement), le site passe en **mode démonstration**. Le bouton « Hab. » propose alors trois profils : Visiteur, Membre ou Admin. L'espace staff y fonctionne avec des données d'exemple, enregistrées seulement dans ton navigateur.

## Structure
```
site73/
  netlify.toml, package.json    configuration Netlify
  contenu/donnees.mjs           contenu complet (privé)
  scripts/build.mjs             génère la version publique caviardée
  netlify/functions/            connexion Discord, contenu, espace staff
  netlify/lib/                  session signée, stockage, caviardage
  public/                       le site publié (14 pages)
```

## Pages
Accueil, Dossiers SCP, Plan, Personnel, Protocoles, Événements, Archives, Règlement, Rejoindre, Laboratoire, Entraînement, Terminal, Mon carnet, Staff.

Contenus inspirés de la Fondation SCP (scp-wiki.wikidot.com), sous licence CC BY-SA 3.0.
