# Site-73 · site web du RP SCP

Site statique (HTML, CSS, JavaScript), sans installation ni compilation. Ouvre `index.html` dans un navigateur ou héberge le dossier `site73/` (Netlify, GitHub Pages…).

## Pages (13)
| Fichier | Contenu |
|---|---|
| `index.html` | Accueil : niveau d'alerte, compteur depuis le dernier incident, prochain événement, dossier du jour, communiqués |
| `confinement.html` | Base de données SCP : recherche, filtres, dossiers suivis et non lus, dossiers papier caviardés, lecture à voix haute |
| `plan.html` | Coupe verticale du site (8 niveaux), itinéraire depuis la Porte A, simulation de brèche avec sirène |
| `personnel.html` | Départements, grades, habilitations, unités FIM, groupes d'intérêt |
| `protocoles.html` | Consignes par rôle et par niveau d'alerte, codes radio, alphabet radio, annonces générales lues à voix haute |
| `evenements.html` | Calendrier, compte à rebours, planning personnel, annonces à copier pour Discord |
| `archives.html` | Chronologie : communiqués, incidents, historique |
| `reglement.html` | Règlement avec recherche et suivi de lecture, sanctions, glossaire, examen d'aptitude |
| `rejoindre.html` | Étapes d'intégration, test « Quel département ? », générateur de fiche avec carte d'accès |
| `laboratoire.html` | Simulateur SCP-914, générateur de rapports, créateur de dossier SCP avec aperçu par habilitation |
| `entrainement.html` | Mini-jeux : « Contact visuel » (SCP-173) et « Protocole de verrouillage » |
| `terminal.html` | Terminal en ligne de commande (tape `aide`) |
| `carnet.html` | Carnet de service : 21 distinctions, statistiques, dossiers lus, planning, réglages |

Sur toutes les pages : recherche globale (<kbd>Ctrl</kbd>+<kbd>K</kbd>), niveau d'habilitation, niveau d'alerte, météo du col et transitions en portes blindées.

## Modifier le contenu
Tout le texte est dans **`assets/js/data.js`** : dossiers SCP, zones du plan, départements, communiqués, événements, protocoles, règlement, quiz, distinctions, FAQ.

- **Lien Discord** : renseigne `config.discord` (ex. `"https://discord.gg/xxxx"`). Tant qu'il est vide, les boutons affichent « lien bientôt disponible ».
- **Niveau d'alerte officiel** : `config.alerte` (`vert`, `jaune`, `orange`, `rouge`, `noir`). Toute la palette du site suit ce niveau.
- **Dernier incident** : `config.dernierIncident` (alimente le compteur de l'accueil).
- **Nouvel événement** : ajoute une entrée dans `evenements` (date ISO avec fuseau, durée en minutes). Le prochain s'affiche sur l'accueil.
- **Nouveau communiqué** : ajoute une entrée dans `archives` avec `type: "communique"`.
- **Caviardage** : `[[3|texte]]` n'est lisible qu'à partir de l'habilitation 3 ; `[DONNÉES SUPPRIMÉES]` reste toujours masqué.

## Fichiers
- `assets/css/site73.css` : styles
- `assets/js/core.js` : en-tête, recherche, carnet, habilitation, dossiers, transitions
- `assets/js/pages.js` : modules des pages du site
- `assets/js/outils.js` : modules des pages outils et lancement de l'ensemble

Le carnet, les réglages et les brouillons sont enregistrés dans le navigateur de chaque visiteur (localStorage).

Contenus inspirés de la Fondation SCP (scp-wiki.wikidot.com), sous licence CC BY-SA 3.0.
