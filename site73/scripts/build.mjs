// Génère public/assets/js/data.js à partir de contenu/donnees.mjs.
// Tous les passages classifiés [[n|…]] sont remplacés par des « ▒ » :
// le fichier public ne contient que ce qu'un visiteur non connecté peut lire.
// Le code staff n'y figure que sous forme d'empreinte.
import { writeFileSync } from "node:fs";
import donnees from "../contenu/donnees.mjs";
import { caviarder, sansSecrets } from "../netlify/lib/caviardage.mjs";

const cible = new URL("../public/assets/js/data.js", import.meta.url);
const entete = `/* FICHIER GÉNÉRÉ AUTOMATIQUEMENT — ne pas modifier.
   Modifie contenu/donnees.mjs puis lance « npm run build ».
   Les passages classifiés sont masqués ; le serveur envoie le reste
   à chaque membre selon son habilitation. */
`;
writeFileSync(cible, entete + "window.S73 = window.S73 || {};\nwindow.S73.data = " + JSON.stringify(caviarder(sansSecrets(donnees), 0), null, 1) + ";\n");
console.log("public/assets/js/data.js généré.");
