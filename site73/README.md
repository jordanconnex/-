# Site-73 · site web du RP SCP

Site du RP SCP « Site-73 » : 14 pages, connexion avec Discord, habilitations attribuées par le staff et espace d'administration. Hébergement prévu sur **Netlify** (fichiers statiques et fonctions serveur).

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
- **En ligne (Netlify + Discord)** : seuls les comptes administrateurs Discord. Le serveur vérifie la session à chaque action : même en trafiquant la page, un membre ne peut rien modifier.
- **Sans serveur** (aperçu, fichier local, hébergement statique) : un **code d'accès staff**, réglé dans `config.codeStaff` du fichier `contenu/donnees.mjs` (par défaut `SITE73-O5`, **change-le**). Le site publié n'en contient que l'empreinte ; après 5 erreurs, l'accès est bloqué 30 secondes. Dans ce mode, tout reste enregistré dans le navigateur de la personne : une modification ne touche jamais les autres visiteurs. Pour que le staff pilote vraiment le site pour tout le monde, il faut la mise en ligne ci-dessous.

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
Tout le texte est dans **`contenu/donnees.mjs`** : dossiers SCP, zones du plan, départements, règlement, protocoles, quiz, distinctions, FAQ. Le lien Discord se met dans `config.discord`, le code staff du mode démonstration dans `config.codeStaff`.

Au déploiement, `npm run build` génère `public/assets/js/data.js`, où les passages classifiés sont remplacés par des « ▒ ». Si tu modifies le contenu et veux l'essayer en local, lance `npm run build`.

Caviardage : `[[3|texte]]` n'est lisible qu'à partir de l'habilitation 3. `[DONNÉES SUPPRIMÉES]` reste toujours masqué.

Les communiqués, les événements et le niveau d'alerte se gèrent aussi depuis la console staff, sans toucher au code.

## Mode démonstration
Ouvert sans serveur (fichier local, aperçu claude.ai, ancien hébergement), le site passe en **mode démonstration** :
- on arrive en visiteur (niveau 0) ;
- « Se connecter (démo) », dans le bouton « Hab. », connecte un membre de démonstration ; son habilitation est celle que le staff lui donne dans la console (niveau 2 par défaut) ;
- le mode staff demande le code d'accès (voir plus haut). La console y fonctionne avec des données d'exemple, enregistrées seulement dans ton navigateur.

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
