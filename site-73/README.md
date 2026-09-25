# Site-73 · site web du RP SCP

Site du RP SCP « Site-73 » : 14 pages, comptes avec identifiant et mot de passe, habilitations attribuées par le staff et espace d'administration. Hébergement sur **Netlify** (offre gratuite) : les pages sont servies comme fichiers statiques, une fonction Netlify gère les comptes et l'espace staff, et **Netlify Blobs** garde les données.

## Comptes et habilitations
- **Visiteur non connecté** : niveau 0. Tous les passages classifiés sont masqués.
- **Membre** : il crée son compte sur la page **Connexion** (bouton « Hab. » → « Créer un compte ») avec un identifiant et un mot de passe. Si `CODE_INSCRIPTION` est réglé, il faut aussi ce code, que le staff donne sur le Discord. Son habilitation vient :
  1. du réglage fait par un admin dans la console staff ;
  2. sinon, du niveau par défaut (`HABILITATION_PAR_DEFAUT`, 1 si rien n'est indiqué).
- **Administrateur principal** : identifiant et mot de passe réglés dans Netlify (`ADMIN_IDENTIFIANT`, `ADMIN_MOT_DE_PASSE`). Il lit tout (niveau 5), active le **mode staff** et peut nommer d'autres administrateurs depuis la console.

Mots de passe : 8 caractères minimum, hachés et salés (PBKDF2-SHA256) avant d'être enregistrés ; personne, même le staff, ne peut les lire. Après 5 erreurs, un compte est bloqué 15 minutes. **Mot de passe oublié** : un admin clique sur « Mot de passe » dans la console, le site affiche un mot de passe provisoire à donner au membre en message privé ; le membre choisit ensuite le sien dans « Mon compte ».

La protection est réelle : le serveur n'envoie à chaque navigateur que les passages autorisés par son habilitation. Un membre ne peut pas lire un passage de niveau supérieur, même en fouillant le code de la page.

## Le mode staff
Le site public est en **lecture seule** : visiteurs et membres ne peuvent changer ni le niveau d'alerte, ni leur habilitation, ni rien d'autre.

Le staff passe par un mode à part :
1. **Sas d'accès** (`staff.html`, lien « Accès staff » en bas de chaque page) : l'identité est vérifiée avant d'entrer.
2. **Mode staff activé** : un bandeau jaune apparaît en haut de chaque page, avec un cadre autour de l'écran. Il permet de changer l'alerte officielle (après confirmation) et de voir le site comme un membre de niveau 0 à 5.
3. **Console staff** à onglets :
   - tableau de bord (alerte, raccourcis, prochains événements, dernières actions) ;
   - niveau d'alerte de tout le site ;
   - comptes des membres : habilitation, mot de passe provisoire, nommer ou retirer un admin, supprimer un compte ;
   - fiches personnage ;
   - communiqués, avec un niveau de visibilité ;
   - événements ;
   - journal des actions du staff.
4. **Quitter le mode staff** fait disparaître toutes les commandes.

Qui peut entrer :
- **En ligne** : seuls les comptes administrateurs. Le serveur relit le compte à chaque action : même en trafiquant la page, un membre ne peut rien modifier, et un admin retiré perd l'accès tout de suite.
- **Sans serveur**, personne : il n'y a pas de mode démonstration. La console staff affiche « Serveur indisponible » tant que la fonction Netlify ne tourne pas (voir la mise en ligne ci-dessous).

## Mise en ligne sur Netlify (une seule fois)

### 1. Créer le site sur Netlify
1. Crée un compte gratuit sur <https://app.netlify.com>.
2. **Add new project → Import an existing project → GitHub**, puis choisis ce dépôt.
3. Réglage indispensable : **Base directory** = `site-73`. Les autres champs (commande `npm run build`, dossier publié `public`, fonctions `netlify/functions`) sont lus dans `site-73/netlify.toml`, qui passe avant l'interface : laisse-les tels quels.
4. **Deploy**. L'adresse du site s'affiche, par exemple `https://site-73.netlify.app` (modifiable dans *Site configuration → Change site name*).

Le stockage (**Netlify Blobs**, magasin `site-73`) se crée tout seul : comptes, alerte, communiqués, événements, fiches et journal. À chaque envoi sur la branche de production, Netlify redéploie le site.

**Site déjà créé avec de mauvais réglages** (erreur « Deploy directory 'dist' does not exist ») : *Site configuration → Build & deploy → Continuous deployment → Build settings → Configure*, mets **Base directory** = `site-73`, enregistre, puis *Deploys → Trigger deploy → Clear cache and deploy site*.

Ne déploie pas en glisser-déposer (Netlify Drop) : il n'envoie que des fichiers, sans la fonction serveur ; le site afficherait « Serveur indisponible ».

### 2. Variables
*Site configuration → Environment variables → Add a variable*. Coche **Contains secret values** pour `SESSION_SECRET`, `ADMIN_MOT_DE_PASSE` et `CODE_INSCRIPTION`. Après un ajout ou un changement, redéploie (*Deploys → Trigger deploy*).

| Variable | Valeur |
|---|---|
| `SESSION_SECRET` | longue chaîne aléatoire, au moins 32 caractères |
| `ADMIN_IDENTIFIANT` | identifiant de l'administrateur principal (3 à 20 caractères : lettres sans accent, chiffres, `.` `_` `-`) |
| `ADMIN_MOT_DE_PASSE` | son mot de passe, 8 caractères minimum |
| `CODE_INSCRIPTION` | *(conseillé)* code à donner sur le Discord pour créer un compte ; vide, tout le monde peut s'inscrire |
| `HABILITATION_PAR_DEFAUT` | *(facultatif)* niveau d'un nouveau compte, 1 par défaut |

Pour fabriquer `SESSION_SECRET` : `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

L'administrateur principal se connecte ensuite sur `/connexion.html` avec cet identifiant et ce mot de passe. Personne ne peut créer de compte à son nom. Changer `ADMIN_MOT_DE_PASSE` ferme ses sessions ouvertes.

### 3. Vérifier
Ouvre `https://ton-site.netlify.app/api/etat` : chaque ligne doit dire « ok » et `connexion` doit dire « prête ». Sinon, la ligne en défaut dit quoi corriger.

### Consommation
Les pages sont servies sans limite pratique. Chaque page ouverte appelle une fois la fonction, et chaque inscription, connexion ou action du staff écrit dans Netlify Blobs. C'est modeste pour un serveur de RP ; la consommation se suit dans *Netlify → Usage*.

### Essayer en local (facultatif)
Il faut [Node.js](https://nodejs.org) **22 ou plus** (vérifie avec `node -v`). Dans le terminal de VS Code, depuis le dossier `site-73` :
```
npm install
cp .env.exemple .env
npm run dev
```
Remplis `.env` (il n'est jamais envoyé sur GitHub), puis ouvre <http://localhost:8888>. Le serveur local fait tourner le même code que Netlify, avec un stockage Netlify Blobs local (dossier `.netlify/`, jamais publié).

### Important
- **Garde le dépôt GitHub privé** : `contenu/donnees.mjs` contient tout le texte classifié.
- **Retirer un admin** : bouton « Retirer admin » dans la console, effet immédiat. Pour déconnecter tout le monde d'un coup, change `SESSION_SECRET`.
- Seul le dossier `public/` est publié. Le contenu classifié et le code du serveur sont intégrés à la fonction Netlify, jamais servis comme fichiers.
- Le fichier `_redirects` à la racine du dépôt empêche le site Complexe 25 (hébergé ailleurs, il publie tout le dépôt) de servir les fichiers privés du Site-73.

## Modifier le contenu
Tout le texte est dans **`contenu/donnees.mjs`** : dossiers SCP, zones du plan, départements, règlement, protocoles, quiz, distinctions, FAQ. Le lien Discord se met dans `config.discord`.

Au déploiement, `npm run build` génère `public/assets/js/data.js`, où les passages classifiés sont remplacés par des « ▒ ». Si tu modifies le contenu et veux l'essayer en local, lance `npm run build`.

Caviardage : `[[3|texte]]` n'est lisible qu'à partir de l'habilitation 3. `[DONNÉES SUPPRIMÉES]` reste toujours masqué.

Les communiqués, les événements et le niveau d'alerte se gèrent aussi depuis la console staff, sans toucher au code.

## Photo des cartes d'identité
Sur la page Rejoindre, chaque joueur peut indiquer son **pseudo Roblox** : la carte d'identité (et celle de Mon carnet) affiche alors le buste de son avatar Roblox. Le serveur va chercher l'image chez Roblox (route `/api/roblox`), rien à configurer.

Sans pseudo Roblox, si le pseudo est introuvable ou sans serveur, la carte garde la silhouette.

## Sans serveur
Le site n'a **pas de mode démonstration**. Ouvert sans son serveur (fichier local, Live Server, glisser-déposer sur Netlify), il reste lisible en visiteur (niveau 0), sans connexion ni espace staff. Le bouton « Hab. » affiche alors **« Serveur indisponible »** avec la raison et un bouton « Réessayer ».

Pour tout avoir en local : `npm run dev`. En ligne : l'import GitHub sur Netlify, jamais le glisser-déposer.

## Structure
```
site-73/
  netlify.toml, package.json    configuration Netlify
  .env.exemple                  liste des variables
  contenu/donnees.mjs           contenu complet (privé)
  scripts/build.mjs             génère la version publique caviardée
  scripts/dev.mjs               serveur local (npm run dev)
  netlify/functions/api.mjs     fonction Netlify : toutes les routes /api/…
  serveur/routeur.mjs           aiguille les routes /api/…
  serveur/routes/               connexion, inscription, mot de passe, contenu, espace staff, photo Roblox, diagnostic
  serveur/comptes.mjs           comptes : mots de passe hachés, admins, essais de connexion
  serveur/commun.mjs            session signée, stockage, fusion du contenu
  serveur/blobs.mjs             stockage Netlify Blobs
  serveur/caviardage.mjs        masque les passages selon l'habilitation
  public/                       le site publié (14 pages, la page de connexion, 404.html)
  public/_headers               en-têtes de sécurité (CSP) : une image, une police ou un script
                                venant d'un autre site doit y être autorisé, sinon il est bloqué
```

## Pages
Accueil, Dossiers SCP, Plan, Personnel, Protocoles, Événements, Archives, Règlement, Rejoindre, Laboratoire, Entraînement, Terminal, Mon carnet, Staff, et la page Connexion / Mon compte.

Contenus inspirés de la Fondation SCP (scp-wiki.wikidot.com), sous licence CC BY-SA 3.0.
