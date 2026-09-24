// Worker Cloudflare du Site-73.
// Les pages de public/ sont servies directement par Cloudflare (fichiers
// statiques). Le Worker ne répond qu'aux routes /api/… ci-dessous.
import { initialiser, json } from "./commun.mjs";
import contenu from "./routes/contenu.mjs";
import connexion from "./routes/connexion.mjs";
import retourDiscord from "./routes/retour-discord.mjs";
import deconnexion from "./routes/deconnexion.mjs";
import staff from "./routes/staff.mjs";

const ROUTES = {
  "/api/contenu": contenu,
  "/api/auth/login": connexion,
  "/api/auth/callback": retourDiscord,
  "/api/auth/logout": deconnexion,
  "/api/staff": staff
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
      // "/" → index.html, "/plan" → plan.html (les liens du site gardent .html)
      const page = pathname === "/" ? "/index.html" : /^\/[a-z0-9-]+$/.test(pathname) ? pathname + ".html" : null;
      const rep = await env.ASSETS.fetch(page ? new Request(new URL(page + new URL(req.url).search, req.url), req) : req);
      return rep.status === 404 ? introuvable() : rep;
    }
    initialiser(env);
    try {
      return await route(req);
    } catch (e) {
      console.error("Site-73 :", e && e.stack || e);
      return json({ erreur: "Erreur du serveur." }, 500);
    }
  }
};
