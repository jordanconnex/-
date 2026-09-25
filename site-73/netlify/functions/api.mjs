// Fonction Netlify du Site-73 : toutes les routes /api/… (contenu selon
// l'habilitation, comptes, console staff, photo Roblox, diagnostic).
import { repondre } from "../../serveur/routeur.mjs";
import { magasinBlobs } from "../../serveur/blobs.mjs";

export default async (req, context) => {
  let magasin = null;
  try {
    magasin = magasinBlobs();
  } catch (e) {
    console.error("Site-73 : Netlify Blobs indisponible :", e.message);
  }
  return repondre(req, { env: process.env, magasin, ip: context && context.ip });
};

export const config = { path: "/api/*" };
