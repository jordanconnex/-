// Fonction Netlify du Site-73 : toutes les routes /api/… (contenu selon
// l'habilitation, comptes, console staff, photo Roblox, diagnostic).
import { repondre } from "../../serveur/routeur.mjs";
import { magasinBlobs } from "../../serveur/blobs.mjs";

// Variables d'environnement du site : Netlify.env est la source fournie par
// Netlify (secrets compris) ; process.env sert en complément.
function variables() {
  let netlify = {};
  try {
    netlify = globalThis.Netlify?.env?.toObject?.() || {};
  } catch (e) {
    console.error("Site-73 : Netlify.env illisible :", e.message);
  }
  return { ...process.env, ...netlify };
}

export default async (req, context) => {
  let magasin = null;
  try {
    magasin = magasinBlobs();
  } catch (e) {
    console.error("Site-73 : Netlify Blobs indisponible :", e.message);
  }
  return repondre(req, { env: variables(), magasin, ip: context && context.ip });
};

export const config = { path: "/api/*" };
