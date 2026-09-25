// Serveur local du Site-73 : « npm run dev », puis http://localhost:8888.
// Même code que sur Netlify : les pages de public/, la fonction /api/… et un
// stockage Netlify Blobs local (dossier .netlify/blobs-local, jamais publié).
// Options : --port 8888  --env .env  --donnees .netlify/blobs-local
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BlobsServer } from "@netlify/blobs/server";
import "./build.mjs"; // data.js à jour
import { repondre } from "../serveur/routeur.mjs";
import { magasinBlobs } from "../serveur/blobs.mjs";

const ici = (p) => fileURLToPath(new URL(p, import.meta.url));
const option = (nom, defaut) => {
  const i = process.argv.indexOf("--" + nom);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : defaut;
};
const PORT = Number(option("port", process.env.PORT || 8888));
const PUBLIC = resolve(ici("../public"));

// Variables : fichier .env (mêmes noms que sur Netlify)
const env = { ...process.env };
const fichierEnv = resolve(option("env", ici("../.env")));
if (existsSync(fichierEnv)) {
  for (const ligne of readFileSync(fichierEnv, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(ligne);
    if (m) env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
} else {
  console.warn("Pas de fichier .env : copie .env.exemple en .env et remplis-le pour pouvoir te connecter.");
}

// Stockage Netlify Blobs local
const jeton = randomBytes(16).toString("hex");
const blobs = new BlobsServer({ directory: resolve(option("donnees", ici("../.netlify/blobs-local"))), token: jeton });
const { port: portBlobs } = await blobs.start();
const urlBlobs = "http://127.0.0.1:" + portBlobs;
const magasin = () => magasinBlobs({ siteID: "site-73-local", token: jeton, edgeURL: urlBlobs, uncachedEdgeURL: urlBlobs });

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".png": "image/png",
  ".jpg": "image/jpeg", ".webp": "image/webp", ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json"
};
// Mêmes en-têtes que sur Netlify : bloc « /* » de public/_headers (CSP comprise)
function entetesNetlify() {
  const entetes = {};
  let dansBloc = false;
  for (const ligne of readFileSync(join(PUBLIC, "_headers"), "utf8").split(/\r?\n/)) {
    if (!ligne.trim() || ligne.trim().startsWith("#")) continue;
    if (!/^\s/.test(ligne)) { dansBloc = ligne.trim() === "/*"; continue; }
    const i = ligne.indexOf(":");
    if (dansBloc && i > 0) entetes[ligne.slice(0, i).trim().toLowerCase()] = ligne.slice(i + 1).trim();
  }
  return entetes;
}
const SECURITE = entetesNetlify();

// Comme Netlify : « / » → index.html, « /plan » → plan.html, sinon 404.html
function fichierPour(chemin) {
  let p;
  try { p = decodeURIComponent(chemin); } catch { return null; }
  if (p.endsWith("/")) p += "index.html";
  for (const essai of [p, p + ".html"]) {
    const f = normalize(join(PUBLIC, essai));
    if (f.startsWith(PUBLIC + "/") && !/\/_(headers|redirects)$/.test(f) && existsSync(f) && statSync(f).isFile()) return f;
  }
  return null;
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://" + (req.headers.host || "localhost:" + PORT));
  try {
    if (url.pathname.startsWith("/api/")) {
      const morceaux = [];
      for await (const m of req) morceaux.push(m);
      const corps = morceaux.length ? Buffer.concat(morceaux) : undefined;
      const requete = new Request(url, { method: req.method, headers: req.headers, body: req.method === "GET" || req.method === "HEAD" ? undefined : corps });
      const rep = await repondre(requete, { env, magasin: magasin(), ip: req.socket.remoteAddress });
      const entetes = {};
      rep.headers.forEach((v, k) => { if (k !== "set-cookie") entetes[k] = v; });
      const cookies = rep.headers.getSetCookie();
      if (cookies.length) entetes["set-cookie"] = cookies;
      res.writeHead(rep.status, entetes);
      res.end(Buffer.from(await rep.arrayBuffer()));
      return;
    }
    const f = fichierPour(url.pathname);
    const cible = f || join(PUBLIC, "404.html");
    res.writeHead(f ? 200 : 404, { "content-type": TYPES[extname(cible)] || "application/octet-stream", "cache-control": "no-cache", ...SECURITE });
    res.end(req.method === "HEAD" ? undefined : readFileSync(cible));
  } catch (e) {
    console.error(e);
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("Erreur du serveur local.");
  }
}).listen(PORT, () => console.log("Site-73 en local : http://localhost:" + PORT));
