// Serveur du Site-73 : aiguille les routes /api/… (fonction Netlify,
// netlify/functions/api.mjs, ou serveur local scripts/dev.mjs).
// Les pages de public/ sont servies directement par Netlify.
import { initialiser, json, rediriger } from "./commun.mjs";
import contenu from "./routes/contenu.mjs";
import connexion from "./routes/connexion.mjs";
import inscription from "./routes/inscription.mjs";
import motDePasse from "./routes/mot-de-passe.mjs";
import deconnexion from "./routes/deconnexion.mjs";
import staff from "./routes/staff.mjs";
import roblox from "./routes/roblox.mjs";
import etat from "./routes/etat.mjs";

const ROUTES = {
  "/api/contenu": contenu,
  "/api/contenu.json": contenu, // adresse (relative) utilisée par les pages
  "/api/auth/connexion": connexion,
  "/api/auth/inscription": inscription,
  "/api/auth/mot-de-passe": motDePasse,
  "/api/auth/logout": deconnexion,
  // Ancienne adresse de connexion (Discord) : mène à la page de connexion
  "/api/auth/login": async () => rediriger("/connexion.html"),
  "/api/staff": staff,
  "/api/roblox": roblox,
  "/api/etat": etat
};

// env : variables (process.env) ; magasin : stockage (serveur/blobs.mjs) ; ip : adresse du visiteur
export async function repondre(req, { env, magasin, ip } = {}) {
  const route = ROUTES[new URL(req.url).pathname];
  if (!route) return json({ erreur: "Introuvable." }, 404);
  initialiser(env, magasin, ip);
  try {
    return await route(req);
  } catch (e) {
    console.error("Site-73 :", e && e.stack || e);
    // Erreurs de configuration : le message aide à corriger, il ne contient aucun secret
    const config = e && /^(Stockage|SESSION_SECRET)/.test(e.message);
    return json({ erreur: config ? e.message : "Erreur du serveur.", diagnostic: "/api/etat" }, 500);
  }
}
