// Outils partagés par le Worker Cloudflare du Site-73 : configuration,
// cookies, session signée, stockage Workers KV et fusion du contenu.
// Uniquement des API web standard (fetch, Web Crypto) : aucun module Node.
import donnees from "../contenu/donnees.mjs";
import { caviarder } from "./caviardage.mjs";

export { donnees };

/* ---------- Configuration ------------------------------------------------ */
// Variables et secrets du Worker : tableau de bord Cloudflare (Settings →
// Variables and Secrets) ou fichier .dev.vars en local.
// worker.mjs appelle initialiser(env) au début de chaque requête.
let ENV = {};
let cache = new Map();
export function initialiser(envWorker) {
  ENV = envWorker || {};
  cache = new Map();
}
export const env = (cle, defaut = "") => String(ENV[cle] || defaut).trim();
const liste = (cle) => env(cle).split(/[\s,;]+/).filter(Boolean);

export const ALERTES = ["vert", "jaune", "orange", "rouge", "noir"];
export const TYPES_EVENEMENT = Object.keys(donnees.typesEvenement);
const DUREE_SESSION = 3 * 24 * 3600 * 1000; // 3 jours
// Adresse de l'API Discord (modifiable seulement pour les tests locaux)
export const apiDiscord = () => env("DISCORD_API_URL", "https://discord.com/api/v10");

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

/* ---------- Adresse du site et retour après connexion ----------------- */
export function urlDuSite(req) {
  return (env("SITE_URL") || new URL(req.url).origin).replace(/\/+$/, "");
}
// N'accepte qu'une page interne du site (évite les redirections ouvertes).
export function retourSur(chemin) {
  return typeof chemin === "string" && /^\/([a-z0-9-]+\.html)?$/.test(chemin) ? chemin : "/";
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

export async function creerSession({ id, nom, avatar, admin }) {
  const corps = b64url(enc.encode(JSON.stringify({ id, nom, avatar, adm: !!admin, exp: Date.now() + DUREE_SESSION })));
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
    return s && s.id && s.exp > Date.now() ? s : null;
  } catch { return null; }
}
export const estAdmin = (session) => !!session && (session.adm || liste("ADMIN_IDS").includes(session.id));

/* ---------- Rôles Discord ---------------------------------------------- */
export const rolesAdmin = () => liste("ADMIN_ROLES");
export const idsAdmin = () => liste("ADMIN_IDS");
export function habilitationDesRoles(roles) {
  // HABILITATION_ROLES="idRole:1,idRole:3" → niveau le plus élevé parmi les rôles du membre
  let max = null;
  for (const paire of liste("HABILITATION_ROLES")) {
    const [role, niveau] = paire.split(":");
    const n = Number(niveau);
    if (roles.includes(role) && n >= 0 && n <= 5) max = Math.max(max ?? 0, n);
  }
  return max;
}
export function habilitationPourMembre(membre, session) {
  if (estAdmin(session)) return { niveau: 5, source: "admin" };
  if (membre && Number.isInteger(membre.override)) return { niveau: membre.override, source: "staff" };
  if (membre && Number.isInteger(membre.roleHab)) return { niveau: membre.roleHab, source: "role" };
  const defaut = Number(env("HABILITATION_PAR_DEFAUT", "1"));
  return { niveau: defaut >= 0 && defaut <= 5 ? defaut : 1, source: "defaut" };
}

/* ---------- Stockage (Workers KV, liaison « SITE73 ») ------------------- */
// Clés : "membres/<id Discord>", "site" (alerte, communiqués, événements),
// "journal". Une petite mémoire par requête garde ce qui vient d'être écrit :
// KV peut mettre quelques secondes à propager une écriture.
export function stockage() {
  const kv = ENV.SITE73;
  if (!kv) throw new Error("Stockage KV « SITE73 » non relié au Worker (voir wrangler.jsonc).");
  return {
    async get(cle) {
      if (cache.has(cle)) return structuredClone(cache.get(cle));
      return kv.get(cle, { type: "json" });
    },
    async setJSON(cle, valeur) {
      cache.set(cle, structuredClone(valeur));
      await kv.put(cle, JSON.stringify(valeur));
    },
    async list({ prefix }) {
      const cles = new Set([...cache.keys()].filter((c) => c.startsWith(prefix)));
      let curseur;
      do {
        const r = await kv.list({ prefix, cursor: curseur });
        for (const k of r.keys) cles.add(k.name);
        curseur = r.list_complete ? null : r.cursor;
      } while (curseur);
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
  delete base.config.codeStaff; // inutile en ligne (Discord), jamais envoyé
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
