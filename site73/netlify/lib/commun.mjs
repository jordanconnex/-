// Outils partagés par les fonctions Netlify du Site-73 :
// configuration, cookies, session signée, stockage et fusion du contenu.
import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";
import donnees from "../../contenu/donnees.mjs";
import { caviarder } from "./caviardage.mjs";

export { donnees };

export const env = (cle, defaut = "") => (process.env[cle] || defaut).trim();
const liste = (cle) => env(cle).split(/[\s,;]+/).filter(Boolean);

export const ALERTES = ["vert", "jaune", "orange", "rouge", "noir"];
export const TYPES_EVENEMENT = Object.keys(donnees.typesEvenement);
const DUREE_SESSION = 3 * 24 * 3600 * 1000; // 3 jours

/* ---------- Réponses ---------------------------------------------------- */
export function json(corps, statut = 200) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
export function rediriger(url, cookies = []) {
  const entetes = new Headers({ location: url, "cache-control": "no-store" });
  for (const c of cookies) entetes.append("set-cookie", c);
  return new Response(null, { status: 302, headers: entetes });
}

/* ---------- Cookies ----------------------------------------------------- */
export function lireCookie(req, nom) {
  const brut = req.headers.get("cookie") || "";
  for (const morceau of brut.split(";")) {
    const i = morceau.indexOf("=");
    if (i > 0 && morceau.slice(0, i).trim() === nom) return decodeURIComponent(morceau.slice(i + 1).trim());
  }
  return null;
}
export function cookie(nom, valeur, maxAgeSecondes) {
  return `${nom}=${encodeURIComponent(valeur)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSecondes}`;
}

/* ---------- Adresse du site et retour après connexion ----------------- */
export function urlDuSite(req) {
  return (env("SITE_URL") || env("URL") || new URL(req.url).origin).replace(/\/+$/, "");
}
// N'accepte qu'une page interne du site (évite les redirections ouvertes).
export function retourSur(chemin) {
  return typeof chemin === "string" && /^\/([a-z0-9-]+\.html)?$/.test(chemin) ? chemin : "/";
}

/* ---------- Session signée (HMAC-SHA256) ------------------------------- */
function secret() {
  const s = env("SESSION_SECRET");
  if (s.length < 32) throw new Error("SESSION_SECRET absent ou trop court (32 caractères minimum).");
  return s;
}
const signature = (corps) => crypto.createHmac("sha256", secret()).update(corps).digest("base64url");

export function creerSession({ id, nom, avatar, admin }) {
  const corps = Buffer.from(JSON.stringify({ id, nom, avatar, adm: !!admin, exp: Date.now() + DUREE_SESSION })).toString("base64url");
  return { jeton: corps + "." + signature(corps), maxAge: DUREE_SESSION / 1000 };
}
export function lireSession(req) {
  const jeton = lireCookie(req, "s73_session");
  if (!jeton || !jeton.includes(".")) return null;
  const [corps, sig] = jeton.split(".");
  let attendu;
  try { attendu = signature(corps); } catch { return null; }
  const a = Buffer.from(sig || ""), b = Buffer.from(attendu);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(Buffer.from(corps, "base64url").toString("utf8"));
    return s && s.id && s.exp > Date.now() ? s : null;
  } catch { return null; }
}
export const estAdmin = (session) => !!session && (session.adm || liste("ADMIN_IDS").includes(session.id));

/* ---------- Rôles Discord ---------------------------------------------- */
export const rolesAdmin = () => liste("ADMIN_ROLES");
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

/* ---------- Stockage ----------------------------------------------------- */
export const stockage = () => getStore({ name: "site73", consistency: "strong" });
export const lireMembre = (id) => stockage().get("membres/" + id, { type: "json" });

export async function lireDynamique() {
  const s = stockage();
  const [etat, communiques, evenements] = await Promise.all([
    s.get("etat", { type: "json" }),
    s.get("communiques", { type: "json" }),
    s.get("evenements", { type: "json" })
  ]);
  return { etat, communiques: communiques || [], evenements };
}

export async function journaliser(par, action) {
  const s = stockage();
  const journal = (await s.get("journal", { type: "json" })) || [];
  journal.unshift({ le: new Date().toISOString(), par, action });
  await s.setJSON("journal", journal.slice(0, 200));
}

/* ---------- Contenu envoyé au navigateur ------------------------------ */
export function contenuPour(niveau, dyn) {
  const base = structuredClone(donnees);
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
