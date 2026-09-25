// Outils partagés par le serveur du Site-73 (fonction Netlify) : configuration,
// cookies, session signée, stockage Netlify Blobs et fusion du contenu.
// Uniquement des API web standard (fetch, Web Crypto) : aucun module Node.
import donnees from "../contenu/donnees.mjs";
import { caviarder } from "./caviardage.mjs";

export { donnees };

/* ---------- Configuration ------------------------------------------------ */
// Variables et secrets : tableau de bord Netlify (Site configuration →
// Environment variables) ou fichier .env en local.
// routeur.mjs appelle initialiser() au début de chaque requête.
let ENV = {};
let MAGASIN = null;
let IP = "";
let cache = new Map();
export function initialiser(env, magasin, ip) {
  ENV = env || {};
  MAGASIN = magasin || null;
  IP = ip || "";
  cache = new Map();
}
// Adresse IP du visiteur (fournie par Netlify), pour limiter les essais de connexion
export const ipClient = () => IP || "local";
export const env = (cle, defaut = "") => String(ENV[cle] || defaut).trim();

export const ALERTES = ["vert", "jaune", "orange", "rouge", "noir"];
export const TYPES_EVENEMENT = Object.keys(donnees.typesEvenement);
const DUREE_SESSION = 7 * 24 * 3600 * 1000; // 7 jours

/* ---------- Réponses ---------------------------------------------------- */
const SECURITE = { "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin", "cache-control": "no-store" };
export function json(corps, statut = 200, entetes = {}) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { "content-type": "application/json; charset=utf-8", ...SECURITE, ...entetes }
  });
}
export function rediriger(url, cookies = []) {
  const entetes = new Headers({ location: url, ...SECURITE });
  for (const c of cookies) entetes.append("set-cookie", c);
  return new Response(null, { status: 302, headers: entetes });
}

/* ---------- Cookies ----------------------------------------------------- */
export function lireCookie(req, nom) {
  const brut = req.headers.get("cookie") || "";
  for (const morceau of brut.split(";")) {
    const i = morceau.indexOf("=");
    if (i > 0 && morceau.slice(0, i).trim() === nom) {
      try { return decodeURIComponent(morceau.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}
export function cookie(nom, valeur, maxAgeSecondes) {
  return `${nom}=${encodeURIComponent(valeur)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSecondes}`;
}

/* ---------- Requêtes POST du site ------------------------------------- */
// Refuse les requêtes venues d'un autre site : en-tête maison + même origine.
export function refuserAutreSite(req) {
  const origine = req.headers.get("origin");
  if (req.headers.get("x-s73") !== "1" || (origine && origine !== new URL(req.url).origin)) {
    return json({ erreur: "Requête refusée." }, 403);
  }
  return null;
}
export async function lireCorps(req) {
  try {
    const corps = await req.json();
    return corps && typeof corps === "object" ? corps : null;
  } catch { return null; }
}

/* ---------- Encodage et hasard ------------------------------------------ */
const enc = new TextEncoder(), dec = new TextDecoder();
const b64url = (octets) => {
  let s = "";
  for (const o of octets) s += String.fromCharCode(o);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const deB64url = (texte) => {
  const s = atob(texte.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((texte.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};
export const aleatoire = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));
export const aleatoireHex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (o) => o.toString(16).padStart(2, "0")).join("");

/* ---------- Session signée (HMAC-SHA256, Web Crypto) ------------------- */
let cleHmac = null, cleDe = "";
async function cleSession() {
  const s = env("SESSION_SECRET");
  if (s.length < 32) throw new Error("SESSION_SECRET absent ou trop court (32 caractères minimum).");
  if (!cleHmac || cleDe !== s) {
    cleHmac = await crypto.subtle.importKey("raw", enc.encode(s), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
    cleDe = s;
  }
  return cleHmac;
}

// v = jeton du compte : il change quand le mot de passe change, ce qui ferme
// les autres sessions de ce compte.
export async function creerSession({ id, nom, v }) {
  const corps = b64url(enc.encode(JSON.stringify({ id, nom, v, exp: Date.now() + DUREE_SESSION })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await cleSession(), enc.encode(corps)));
  return { jeton: corps + "." + b64url(sig), maxAge: DUREE_SESSION / 1000 };
}
export async function lireSession(req) {
  const jeton = lireCookie(req, "s73_session");
  if (!jeton) return null;
  const [corps, sig, reste] = jeton.split(".");
  if (!corps || !sig || reste !== undefined) return null;
  try {
    // verify compare en temps constant
    if (!(await crypto.subtle.verify("HMAC", await cleSession(), deB64url(sig), enc.encode(corps)))) return null;
    const s = JSON.parse(dec.decode(deB64url(corps)));
    return s && s.id && s.v && s.exp > Date.now() ? s : null;
  } catch { return null; }
}

/* ---------- Stockage (Netlify Blobs, magasin « site-73 ») --------------- */
// Clés : "membres/<identifiant>", "site" (alerte, communiqués, événements),
// "journal", "fiches", "essais/…" (connexions ratées, effacées toutes seules).
// Une petite mémoire par requête garde ce qui vient d'être écrit.
// MAGASIN : { get, set, delete, list } (voir serveur/blobs.mjs).
export function stockage() {
  const m = MAGASIN;
  if (!m) throw new Error("Stockage Netlify Blobs indisponible (voir /api/etat).");
  return {
    async get(cle) {
      if (cache.has(cle)) return structuredClone(cache.get(cle));
      return m.get(cle);
    },
    async setJSON(cle, valeur) {
      cache.set(cle, structuredClone(valeur));
      await m.set(cle, valeur);
    },
    async delete(cle) {
      cache.set(cle, null);
      await m.delete(cle);
    },
    async list({ prefix }) {
      const cles = new Set([...cache.keys()].filter((c) => c.startsWith(prefix) && cache.get(c) !== null));
      for (const cle of await m.list(prefix)) if (cache.get(cle) !== null) cles.add(cle);
      return [...cles];
    }
  };
}
export const lireMembre = (id) => stockage().get("membres/" + id);

export async function lireDynamique() {
  const site = (await stockage().get("site")) || {};
  return { etat: site.etat || null, communiques: site.communiques || [], evenements: site.evenements || null };
}
export async function ecrireDynamique(modif) {
  const s = stockage();
  const site = (await s.get("site")) || {};
  await s.setJSON("site", { ...site, ...modif });
}

export async function journaliser(par, action) {
  const s = stockage();
  const journal = (await s.get("journal")) || [];
  journal.unshift({ le: new Date().toISOString(), par, action });
  await s.setJSON("journal", journal.slice(0, 200));
}

/* ---------- Contenu envoyé au navigateur ------------------------------ */
export function contenuPour(niveau, dyn) {
  const base = structuredClone(donnees);
  delete base.config.codeStaff; // ancien code du mode démo, s'il traîne encore : jamais envoyé
  if (dyn.etat && ALERTES.includes(dyn.etat.alerte)) base.config.alerte = dyn.etat.alerte;
  const communiques = (dyn.communiques || [])
    .filter((c) => (c.niveau || 0) <= niveau)
    .map((c) => ({ id: c.id, date: c.date, type: "communique", titre: c.titre, texte: c.texte, auteur: c.auteur, niveau: c.niveau || 0, dyn: true }));
  base.archives = communiques.concat(base.archives);
  if (Array.isArray(dyn.evenements)) base.evenements = dyn.evenements;
  return caviarder(base, niveau);
}

export const dateParis = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

// "2026-09-26T21:00" (heure de Paris) → "2026-09-26T21:00:00+02:00"
export function isoParis(local) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local || "")) return null;
  const decalage = (d) => {
    const nom = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", timeZoneName: "shortOffset" })
      .formatToParts(d).find((p) => p.type === "timeZoneName").value;
    const m = /GMT(?:([+-]\d+)(?::(\d+))?)?/.exec(nom);
    const h = m && m[1] ? Number(m[1]) : 0;
    return h * 60 + (m && m[2] ? Math.sign(h) * Number(m[2]) : 0);
  };
  const approx = new Date(local + ":00Z");
  if (isNaN(approx)) return null;
  const minutes = decalage(new Date(approx.getTime() - decalage(approx) * 60000));
  const a = Math.abs(minutes);
  return `${local}:00${minutes >= 0 ? "+" : "-"}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}
