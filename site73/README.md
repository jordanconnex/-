# Site-73 · site web du RP SCP

Site statique (HTML, CSS, JavaScript), sans installation ni compilation. Ouvre `index.html` dans un navigateur ou héberge le dossier `site73/` (Netlify, GitHub Pages…).

## Pages
| Fichier | Contenu |
|---|---|
| `index.html` | Accueil : niveau d'alerte, compteur depuis le dernier incident, dossier du jour, communiqués |
| `confinement.html` | Base de données SCP : recherche, filtres, dossiers papier caviardés selon l'habilitation |
| `plan.html` | Coupe verticale interactive du site (8 niveaux) et simulation de brèche avec sirène |
| `personnel.html` | Départements, grades, habilitations, unités FIM, groupes d'intérêt |
| `archives.html` | Chronologie : communiqués, incidents, historique |
| `terminal.html` | Terminal en ligne de commande (tape `aide`) |
| `reglement.html` | Règlement, sanctions, glossaire, examen d'aptitude |
| `rejoindre.html` | Étapes d'intégration, générateur de fiche personnage avec carte d'accès, FAQ |

## Modifier le contenu
Tout le texte est dans **`assets/js/data.js`** : dossiers SCP, zones du plan, départements, communiqués, règlement, quiz, FAQ.

- **Lien Discord** : renseigne `config.discord` (ex. `"https://discord.gg/xxxx"`). Tant qu'il est vide, les boutons affichent « lien bientôt disponible ».
- **Niveau d'alerte officiel** : `config.alerte` (`vert`, `jaune`, `orange`, `rouge`, `noir`). Toute la palette du site suit ce niveau.
- **Dernier incident** : `config.dernierIncident` (alimente le compteur de l'accueil).
- **Nouveau communiqué** : ajoute une entrée dans `archives` avec `type: "communique"`. Les trois plus récents s'affichent sur l'accueil.
- **Caviardage** : `[[3|texte]]` n'est lisible qu'à partir de l'habilitation 3 ; `[DONNÉES SUPPRIMÉES]` reste toujours masqué.

Contenus inspirés de la Fondation SCP (scp-wiki.wikidot.com), sous licence CC BY-SA 3.0.
