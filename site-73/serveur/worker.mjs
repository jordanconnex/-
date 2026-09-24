// Worker Cloudflare du Site-73.
// Les pages de public/ sont servies directement par Cloudflare (fichiers
// statiques). Le Worker répond aux routes /api/… ci-dessous (wrangler.jsonc :
// run_worker_first), avant les fichiers. Aussi utilisé par Cloudflare Pages
// via functions/api/[[chemin]].js.
import { initialiser, json } from "./commun.mjs";
import contenu from "./routes/contenu.mjs";
import connexion from "./routes/connexion.mjs";
import retourDiscord from "./routes/retour-discord.mjs";
import deconnexion from "./routes/deconnexion.mjs";
import staff from "./routes/staff.mjs";
import roblox from "./routes/roblox.mjs";
import etat from "./routes/etat.mjs";

const ROUTES = {
  "/api/contenu": contenu,
  "/api/contenu.json": contenu, // adresse utilisée par les pages (voir public/api/contenu.json)
  "/api/auth/login": connexion,
  "/api/auth/callback": retourDiscord,
  "/api/auth/logout": deconnexion,
  "/api/staff": staff,
  "/api/roblox": roblox,
  "/api/etat": etat
};

const introuvable = () => new Response(
  '<!DOCTYPE html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
  "<title>Introuvable · Site-73</title><body style=\"margin:0;min-height:100vh;display:grid;place-items:center;background:#0C1215;color:#DCE4E2;font:16px/1.5 system-ui,sans-serif;text-align:center\">" +
  '<div><p style="font:600 12px monospace;letter-spacing:.2em;color:#F2C230">ERREUR 404 · DOSSIER INTROUVABLE</p>' +
  '<p>Cette page n\'existe pas, ou elle a été classifiée.</p><p><a href="/" style="color:#F2C230">Retour à l\'intranet du Site-73</a></p></div></body></html>',
  { status: 404, headers: { "content-type": "text/html; charset=utf-8", "x-content-type-options": "nosniff" } }
);

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    const route = ROUTES[pathname];
    if (!route) {
      if (pathname.startsWith("/api/")) return json({ erreur: "Introuvable." }, 404);
      if (!env.ASSETS) {
        return new Response("Site-73 : le Worker a été déployé sans le dossier public (liaison ASSETS absente). Redéploie avec « npm run deploy » ou l'import GitHub, qui lisent wrangler.jsonc.",
          { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
      }
      // "/" → index.html, "/plan" → plan.html (les liens du site gardent .html)
      const page = pathname === "/" ? "/index.html" : /^\/[a-z0-9-]+$/.test(pathname) ? pathname + ".html" : null;
      try {
        const rep = await env.ASSETS.fetch(page ? new Request(new URL(page + new URL(req.url).search, req.url), req) : req);
        return rep.status === 404 ? introuvable() : rep;
      } catch (e) {
        console.error("Site-73 : fichier", pathname, e && e.stack || e);
        return introuvable();
      }
    }
    initialiser(env);
    try {
      return await route(req);
    } catch (e) {
      console.error("Site-73 :", e && e.stack || e);
      // Erreurs de configuration : le message aide à corriger, il ne contient aucun secret
      const config = e && /^(Stockage KV|SESSION_SECRET)/.test(e.message);
      return json({ erreur: config ? e.message : "Erreur du serveur.", diagnostic: "/api/etat" }, 500);
    }
  }
};
