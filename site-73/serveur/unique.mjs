// Point d'entrée du Worker « en un seul fichier » (npm run worker-unique) :
// les fichiers de public/ sont rangés dans le code au lieu d'être envoyés
// à part. Il remplace la liaison ASSETS, avec le même comportement
// (html_handling « none »), et ignore les fichiers envoyés en glisser-déposer.
import worker from "./worker.mjs";
import FICHIERS from "site73:fichiers";

// Mêmes en-têtes que public/_headers
const ENTETES = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "SAMEORIGIN"
};
const octets = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

const fichiers = {
  async fetch(req) {
    const f = FICHIERS[new URL(req.url).pathname];
    if (!f) return new Response("Introuvable", { status: 404 });
    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response("Méthode non autorisée", { status: 405, headers: { allow: "GET, HEAD" } });
    }
    const entetes = { ...ENTETES, "content-type": f.type, etag: f.etag, "cache-control": "no-cache" };
    if (req.headers.get("if-none-match") === f.etag) return new Response(null, { status: 304, headers: entetes });
    return new Response(req.method === "HEAD" ? null : f.b64 ? octets(f.b64) : f.texte, { headers: entetes });
  }
};

export default {
  fetch(req, env, ctx) {
    return worker.fetch(req, { ...env, ASSETS: fichiers }, ctx);
  }
};
